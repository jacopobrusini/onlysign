import crypto from "crypto";
import { db } from "@/prisma/db";

const PPQCHECK_API_BASE =
  "https://br.api-developer.dev";

const PPQCHECK_NETWORK =
  "binance";

const PPQCHECK_API_KEY =
  process.env.PPQCHECK_API_KEY;

const PAYMOS_API_BASE =
  "https://api.paymos.io/v1";

const PAYMOS_PAYOUT_KEY =
  process.env.PAYMOS_PAYOUT_KEY;

const PAYMOS_API_SECRET =
  process.env.PAYMOS_API_SECRET;

const PPQCHECK_BUDGET_PER_TOKEN =
  1.4;

const PPQCHECK_BALANCE_POLL_ATTEMPTS =
  20;

const PPQCHECK_BALANCE_POLL_DELAY_MS =
  3000;

export {
  PPQCHECK_BUDGET_PER_TOKEN,
};

function requireEnv(
  name: string,
  value: string | undefined
) {
  if (!value) {
    throw new Error(
      `${name}_MISSING`
    );
  }

  return value;
}

function sleep(
  milliseconds: number
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}

async function getPpqcheckBalance() {
  const apiKey =
    requireEnv(
      "PPQCHECK_API_KEY",
      PPQCHECK_API_KEY
    );

  const response =
    await fetch(
      `${PPQCHECK_API_BASE}/v1/integration/wallet/usdt-balance`,
      {
        method: "GET",

        headers: {
          "X-API-Key": apiKey,
        },

        cache: "no-store",
      }
    );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `PPQCHECK_BALANCE_FAILED:${response.status}:${text}`
    );
  }

  const json =
    await response.json();

  const balance =
    Number(
      json?.data?.balance
    );

  if (!Number.isFinite(balance)) {
    throw new Error(
      "INVALID_PPQCHECK_BALANCE"
    );
  }

  return balance;
}

async function getTokenCoverage() {
  const users =
    await db.orm.public.User
      .all();

  let totalTokens = 0;

  for (const user of users) {
    const tokenBalance =
      Number(
        user.tokenBalance
      );

    if (
      !Number.isFinite(
        tokenBalance
      ) ||
      tokenBalance < 0
    ) {
      throw new Error(
        "INVALID_USER_TOKEN_BALANCE"
      );
    }

    totalTokens +=
      tokenBalance;
  }

  return (
    totalTokens *
    PPQCHECK_BUDGET_PER_TOKEN
  );
}

export async function getSyncCredit() {
  const ppqAmount =
    await getPpqcheckBalance();

  const ppqCoverage =
    await getTokenCoverage();

  if (
    ppqAmount <
    ppqCoverage
  ) {
    throw new Error(
      "PPQCHECK_BELOW_COVERAGE"
    );
  }

  const availableCredit =
    ppqAmount -
    ppqCoverage;

  console.log(
    "SyncCredit calculation",
    {
      ppqAmount,
      ppqCoverage,
      availableCredit,
    }
  );

  return {
    ppqAmount,
    ppqCoverage,
    availableCredit,
  };
}

async function createPpqcheckDeposit(
  amount: number
) {
  const apiKey =
    requireEnv(
      "PPQCHECK_API_KEY",
      PPQCHECK_API_KEY
    );

  const response =
    await fetch(
      `${PPQCHECK_API_BASE}/v1/integration/wallet/deposit-usdt`,
      {
        method: "POST",

        headers: {
          "X-API-Key": apiKey,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          amount:
            Number(
              amount.toFixed(2)
            ),

          network:
            PPQCHECK_NETWORK,
        }),

        cache: "no-store",
      }
    );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `PPQCHECK_DEPOSIT_FAILED:${response.status}:${text}`
    );
  }

  const json =
    await response.json();

  const deposit =
    json?.data;

  if (!deposit?.address) {
    throw new Error(
      "PPQCHECK_DEPOSIT_ADDRESS_MISSING"
    );
  }

  const amountUsdt =
    Number(
      deposit.amount_usdt
    );

  if (
    !Number.isFinite(
      amountUsdt
    )
  ) {
    throw new Error(
      "INVALID_PPQCHECK_DEPOSIT_AMOUNT"
    );
  }

  return {
    id:
      deposit.id,

    address:
      deposit.address,

    amountUsdt,

    network:
      deposit.network,

    expiresAt:
      deposit.expiresAt,
  };
}

function createPaymosSignature(
  timestamp: string,
  method: string,
  path: string,
  query: string,
  body: string
) {
  const apiSecret =
    requireEnv(
      "PAYMOS_API_SECRET",
      PAYMOS_API_SECRET
    );

  const bodyHash =
    body
      ? crypto
          .createHash(
            "sha256"
          )
          .update(body)
          .digest("hex")
      : "";

  const stringToSign =
    `${timestamp}\n${method}\n${path}\n${query}\n${bodyHash}`;

  return crypto
    .createHmac(
      "sha256",
      apiSecret
    )
    .update(
      stringToSign
    )
    .digest("base64");
}

async function createPaymosWithdrawal(
  amount: number,
  destinationAddress: string,
  externalOrderId: string
) {
  const apiKey =
    requireEnv(
      "PAYMOS_PAYOUT_KEY",
      PAYMOS_PAYOUT_KEY
    );

  const path =
    "/v1/withdrawals";

  const body =
    JSON.stringify({
      amount:
        amount.toFixed(2),

      currency:
        "USDT",

      network:
        "BEP20",

      destination_address:
        destinationAddress,

      external_order_id:
        externalOrderId,
    });

  const timestamp =
    Math.floor(
      Date.now() / 1000
    ).toString();

  const signature =
    createPaymosSignature(
      timestamp,
      "POST",
      path,
      "",
      body
    );

  const response =
    await fetch(
      `${PAYMOS_API_BASE}${path}`,
      {
        method: "POST",

        headers: {
          Authorization:
            `HMAC-SHA256 ${apiKey}:${signature}`,

          "X-Request-Timestamp":
            timestamp,

          "Content-Type":
            "application/json",
        },

        body,

        cache: "no-store",
      }
    );

  const text =
    await response.text();

type PaymosWithdrawalResponse = {
  withdrawal_id?: string;
  status?: string;
  [key: string]: unknown;
};

let json: PaymosWithdrawalResponse = {};

try {
  const parsed: unknown = JSON.parse(text);

  if (
    typeof parsed === "object" &&
    parsed !== null
  ) {
    json =
      parsed as PaymosWithdrawalResponse;
  } else {
    json = {
      raw: text,
    };
  }
} catch {
  json = {
    raw: text,
  };
}

  if (!response.ok) {
    throw new Error(
      `PAYMOS_WITHDRAWAL_FAILED:${response.status}:${JSON.stringify(json)}`
    );
  }

  return json;
}

type FundingMetadata = {
  version: 1;

  status:
    | "PENDING"
    | "COMPLETED"
    | "FAILED";

  externalOrderId:
    string;

  amount:
    number;

  depositId:
    string;

  depositAddress:
    string;

  withdrawalId?:
    string;

  withdrawalStatus?:
    string;
};

function parseFundingMetadata(
  description:
    string | null | undefined
) {
  if (!description) {
    return null;
  }

  try {
    const metadata =
      JSON.parse(
        description
      ) as FundingMetadata;

    if (
      metadata?.version !== 1 ||
      !metadata.externalOrderId ||
      !metadata.depositAddress
    ) {
      return null;
    }

    return metadata;
  } catch {
    return null;
  }
}

export async function ensurePpqcheckFunding(
  purchaseId: number,
  operationAmount: number,
  externalOrderId: string
) {
  if (
    !Number.isFinite(
      operationAmount
    ) ||
    operationAmount <= 0
  ) {
    throw new Error(
      "INVALID_FUNDING_AMOUNT"
    );
  }

  const syncCredit =
    await getSyncCredit();

  console.log(
    "SyncCredit check",
    {
      purchaseId,

      ppqAmount:
        syncCredit.ppqAmount,

      ppqCoverage:
        syncCredit.ppqCoverage,

      availableCredit:
        syncCredit.availableCredit,

      operationAmount,
    }
  );

  /*
   * Il margine è sufficiente.
   *
   * Non trasferiamo nulla.
   */
  if (
    syncCredit.availableCredit >=
    operationAmount
  ) {
    return {
      funded: false,

      pending: false,

      ppqAmount:
        syncCredit.ppqAmount,

      ppqCoverage:
        syncCredit.ppqCoverage,

      availableCredit:
        syncCredit.availableCredit,

      fundingAmount: 0,
    };
  }

  /*
   * Da qui in poi il funding deve essere
   * ESATTAMENTE pari all'intera operation.
   */
  const fundingAmount =
    operationAmount;

  /*
   * Recuperiamo un eventuale funding
   * già creato per questo acquisto.
   */
  const existingTransactions =
    await db.orm.public.PpqcheckTransaction
      .where({
        tokenPurchaseId:
          purchaseId,
      })
      .all();

  const existingTransaction =
    existingTransactions[0];

  let metadata =
    parseFundingMetadata(
      existingTransaction?.description
    );

  /*
   * Se non abbiamo ancora creato
   * il deposito PPQCheck, lo creiamo.
   */
  if (!metadata) {
    const deposit =
      await createPpqcheckDeposit(
        fundingAmount
      );

    metadata = {
      version: 1,

      status:
        "PENDING",

      externalOrderId,

      amount:
        fundingAmount,

      depositId:
        String(
          deposit.id
        ),

      depositAddress:
        deposit.address,
    };

    /*
     * Salviamo il riferimento prima
     * del payout.
     *
     * Questo rende il retry sicuro:
     * se il processo cade dopo il deposito,
     * possiamo riutilizzare lo stesso address.
     */
    if (!existingTransaction) {
      await db.orm.public.PpqcheckTransaction.create({
        type:
          "CREDIT",

        amount:
          fundingAmount.toFixed(2),

        tokenPurchaseId:
          purchaseId,

        description:
          JSON.stringify(
            metadata
          ),
      });
    } else {
      await db.orm.public.PpqcheckTransaction
        .where({
          id:
            existingTransaction.id,
        })
        .update({
          description:
            JSON.stringify(
              metadata
            ),
        });
    }
  }

  /*
   * Il payout Paymos è idempotente tramite
   * external_order_id.
   */
  const withdrawal =
    await createPaymosWithdrawal(
      fundingAmount,

      metadata.depositAddress,

      metadata.externalOrderId
    );

  const withdrawalId =
    withdrawal?.withdrawal_id;

  const withdrawalStatus =
    withdrawal?.status;

  metadata = {
    ...metadata,

    status:
      "PENDING",

    withdrawalId,

    withdrawalStatus,
  };

  const fundingTransaction =
    await db.orm.public.PpqcheckTransaction
      .where({
        tokenPurchaseId:
          purchaseId,
      })
      .first();

  if (!fundingTransaction) {
    throw new Error(
      "PPQCHECK_FUNDING_TRANSACTION_MISSING"
    );
  }

  await db.orm.public.PpqcheckTransaction
    .where({
      id:
        fundingTransaction.id,
    })
    .update({
      description:
        JSON.stringify(
          metadata
        ),
    });

  console.log(
    "PPQCheck funding created",
    {
      purchaseId,

      fundingAmount,

      depositId:
        metadata.depositId,

      withdrawalId,

      withdrawalStatus,
    }
  );

  return {
    funded: true,

    pending: true,

    ppqAmount:
      syncCredit.ppqAmount,

    ppqCoverage:
      syncCredit.ppqCoverage,

    availableCredit:
      syncCredit.availableCredit,

    fundingAmount,

    depositId:
      metadata.depositId,

    ppqcheckAddress:
      metadata.depositAddress,

    withdrawalId,

    withdrawalStatus,
  };
}

async function waitForPpqcheckCoverage(
  targetCoverage: number
) {
  for (
    let attempt = 1;
    attempt <=
    PPQCHECK_BALANCE_POLL_ATTEMPTS;
    attempt++
  ) {
    const ppqAmount =
      await getPpqcheckBalance();

    console.log(
      "PPQCheck balance verification",
      {
        attempt,

        ppqAmount,

        targetCoverage,
      }
    );

    if (
      ppqAmount >=
      targetCoverage
    ) {
      return ppqAmount;
    }

    if (
      attempt <
      PPQCHECK_BALANCE_POLL_ATTEMPTS
    ) {
      await sleep(
        PPQCHECK_BALANCE_POLL_DELAY_MS
      );
    }
  }

  throw new Error(
    "PPQCHECK_FUNDING_NOT_VISIBLE"
  );
}

export async function finalizeTokenPurchase(
  purchaseId: number
) {
  const purchase =
    await db.orm.public.TokenPurchase
      .where({
        id:
          purchaseId,
      })
      .first();

  if (!purchase) {
    throw new Error(
      "TOKEN_PURCHASE_NOT_FOUND"
    );
  }

  /*
   * Se i token sono già stati accreditati,
   * non facciamo nulla.
   */
  const existingTokenTransactions =
    await db.orm.public.TokenTransaction
      .where({
        purchaseId:
          purchase.id,
      })
      .all();

  if (
    existingTokenTransactions.length >
    0
  ) {
    return {
      completed: true,

      alreadyCompleted: true,

      purchaseId:
        purchase.id,

      tokens:
        purchase.tokens,
    };
  }

  const operationAmount =
    purchase.tokens *
    PPQCHECK_BUDGET_PER_TOKEN;

  /*
   * Coverage prima dell'acquisto.
   */
  const before =
    await getSyncCredit();

  /*
   * Dopo l'acquisto la coverage aumenta
   * esattamente di operationAmount.
   */
  const targetCoverage =
    before.ppqCoverage +
    operationAmount;

  /*
   * NON accreditiamo i token finché
   * PPQCheck non dimostra realmente
   * di avere abbastanza saldo.
   */
  const ppqAmount =
    await waitForPpqcheckCoverage(
      targetCoverage
    );

  if (
    ppqAmount <
    targetCoverage
  ) {
    throw new Error(
      "PPQCHECK_BELOW_TARGET_COVERAGE"
    );
  }

  const result =
    await db.transaction(
      async (tx) => {
        const alreadyCredited =
          await tx.orm.public.TokenTransaction
            .where({
              purchaseId:
                purchase.id,
            })
            .first();

        if (
          alreadyCredited
        ) {
          return {
            alreadyCompleted:
              true,
          };
        }

        const incrementPlan =
          tx.sql.public.user
            .update(
              (f, fns) => ({
                tokenBalance:
                  fns.raw`${f.tokenBalance} + ${purchase.tokens}`
                    .returns(
                      "pg/int4@1"
                    ),
              })
            )
            .where(
              (f, fns) =>
                fns.eq(
                  f.id,
                  purchase.userId
                )
            )
            .build();

        await tx.execute(
          incrementPlan
        );

        await tx.orm.public.TokenTransaction.create({
          userId:
            purchase.userId,

          amount:
            purchase.tokens,

          type:
            "PURCHASE",

          purchaseId:
            purchase.id,
        });

        await tx.orm.public.TokenPurchase
          .where({
            id:
              purchase.id,
          })
          .update({
            paymentStatus:
              "PAID_FUNDED",
          });

        return {
          alreadyCompleted:
            false,
        };
      }
    );

  /*
   * Aggiorniamo il log PPQCheck.
   */
  const fundingTransaction =
    await db.orm.public.PpqcheckTransaction
      .where({
        tokenPurchaseId:
          purchase.id,
      })
      .first();

  if (fundingTransaction) {
    const metadata =
      parseFundingMetadata(
        fundingTransaction.description
      );

    if (metadata) {
      await db.orm.public.PpqcheckTransaction
        .where({
          id:
            fundingTransaction.id,
        })
        .update({
          description:
            JSON.stringify({
              ...metadata,

              status:
                "COMPLETED",
            }),
        });
    }
  }

  const after =
    await getSyncCredit();

  /*
   * Questa verifica è fondamentale:
   * dopo l'accredito dei token la coverage
   * deve essere ancora coperta.
   */
  if (
    after.ppqAmount <
    after.ppqCoverage
  ) {
    throw new Error(
      "PPQCHECK_BELOW_COVERAGE_AFTER_TOKEN_CREDIT"
    );
  }

  console.log(
    "Token purchase finalized",
    {
      purchaseId:
        purchase.id,

      tokens:
        purchase.tokens,

      ppqAmount:
        after.ppqAmount,

      ppqCoverage:
        after.ppqCoverage,

      availableCredit:
        after.availableCredit,
    }
  );

  return {
    completed: true,

    alreadyCompleted:
      result.alreadyCompleted,

    purchaseId:
      purchase.id,

    tokens:
      purchase.tokens,

    ppqAmount:
      after.ppqAmount,

    ppqCoverage:
      after.ppqCoverage,

    availableCredit:
      after.availableCredit,
  };
}

export async function processPaidTokenPurchase(
  purchaseId: number
) {
  const purchase =
    await db.orm.public.TokenPurchase
      .where({
        id:
          purchaseId,
      })
      .first();

  if (!purchase) {
    throw new Error(
      "TOKEN_PURCHASE_NOT_FOUND"
    );
  }

  const existingTransaction =
    await db.orm.public.TokenTransaction
      .where({
        purchaseId:
          purchase.id,
      })
      .first();

  if (
    existingTransaction
  ) {
    return {
      status:
        "COMPLETED",
    };
  }

  if (
    purchase.status !==
    "PAID"
  ) {
    throw new Error(
      "TOKEN_PURCHASE_NOT_PAID"
    );
  }

  const operationAmount =
    purchase.tokens *
    PPQCHECK_BUDGET_PER_TOKEN;

  const fundingOrderId =
    `onlysign_ppq_funding_${purchase.id}`;

  const funding =
    await ensurePpqcheckFunding(
      purchase.id,

      operationAmount,

      fundingOrderId
    );

  if (
    !funding.funded
  ) {
    /*
     * Il margine era già sufficiente.
     *
     * Possiamo verificare subito che
     * PPQCheck copra anche la nuova coverage.
     */
    return finalizeTokenPurchase(
      purchase.id
    );
  }

  /*
   * Funding creato:
   *
   * NON accreditiamo ancora i token.
   *
   * Aspettiamo withdrawal.completed.
   */
  await db.orm.public.TokenPurchase
    .where({
      id:
        purchase.id,
    })
    .update({
      paymentStatus:
        "PAID_FUNDING_PENDING",
    });

  return {
    status:
      "FUNDING_PENDING",

    purchaseId:
      purchase.id,

    tokens:
      purchase.tokens,

    fundingAmount:
      funding.fundingAmount,

    withdrawalId:
      funding.withdrawalId,

    withdrawalStatus:
      funding.withdrawalStatus,
  };
}

export async function markFundingFailed(
  purchaseId: number
) {
  const transaction =
    await db.orm.public.PpqcheckTransaction
      .where({
        tokenPurchaseId:
          purchaseId,
      })
      .first();

  if (transaction) {
    const metadata =
      parseFundingMetadata(
        transaction.description
      );

    if (metadata) {
      await db.orm.public.PpqcheckTransaction
        .where({
          id:
            transaction.id,
        })
        .update({
          description:
            JSON.stringify({
              ...metadata,

              status:
                "FAILED",
            }),
        });
    }
  }

  await db.orm.public.TokenPurchase
    .where({
      id:
        purchaseId,
    })
    .update({
      paymentStatus:
        "PAID_FUNDING_FAILED",
    });
}