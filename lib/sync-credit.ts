import { db } from "@/prisma/db";

const PPQCHECK_API_BASE =
  "https://br.api-developer.dev";

const PPQCHECK_NETWORK =
  process.env.PPQCHECK_NETWORK;

const PPQCHECK_API_KEY =
  process.env.PPQCHECK_API_KEY;

const PAYMOS_GATEWAY_URL =
  process.env.PAYMOS_GATEWAY_URL;

const PAYMOS_GATEWAY_SECRET =
  process.env.PAYMOS_GATEWAY_SECRET;

const PPQCHECK_BUDGET_PER_TOKEN =
  1.4;

const PPQCHECK_BALANCE_POLL_ATTEMPTS =
  20;

const PPQCHECK_BALANCE_POLL_DELAY_MS =
  3000;

type FundingStatus =
  | "PENDING"
  | "COMPLETED"
  | "FAILED";

type FundingMetadata = {
  version: 3;
  status: FundingStatus;
  externalOrderId: string;
  amount: number;
  depositAddress: string;
  depositId?: string;
  depositNetwork?: string;
  depositExpiresAt?: string;
  withdrawalId?: string;
  withdrawalStatus?: string;
};

type PpqcheckDepositResponse = {
  id?: string;
  address?: string;
  amount_usdt?: number | string;
  network?: string;
  expiresAt?: string;
  qr?: unknown;
  [key: string]: unknown;
};

type PaymosWithdrawalResponse = {
  withdrawal_id?: string;
  status?: string;
  [key: string]: unknown;
};

function requireEnv(
  name: string,
  value: string | undefined
) {
  if (!value) {
    throw new Error(`${name}_MISSING`);
  }

  return value;
}

function sleep(
  milliseconds: number
) {
  return new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );
}

function getFundingDescription(
  metadata: FundingMetadata
) {
  return JSON.stringify(metadata);
}

function parseFundingDescription(
  description: string | null | undefined
): FundingMetadata | null {
  if (!description) {
    return null;
  }

  try {
    const parsed: unknown =
      JSON.parse(description);

    if (
      typeof parsed !== "object" ||
      parsed === null
    ) {
      return null;
    }

    const value =
      parsed as Record<string, unknown>;

    if (
      (value.version !== 2 &&
        value.version !== 3) ||
      typeof value.status !== "string" ||
      typeof value.externalOrderId !== "string" ||
      typeof value.amount !== "number" ||
      typeof value.depositAddress !== "string"
    ) {
      return null;
    }

    return value as unknown as FundingMetadata;
  } catch {
    return null;
  }
}

async function getPpqcheckBalance() {
  const apiKey =
    requireEnv(
      "PPQCHECK_API_KEY",
      PPQCHECK_API_KEY
    );

  const response =
    await fetch(
      `${PPQCHECK_API_BASE}/v1/integration/balance`,
      {
        method: "GET",

        headers: {
          "X-API-Key": apiKey,
        },

        cache: "no-store",
      }
    );

  const text =
    await response.text();

  let data: unknown;

  try {
    data =
      JSON.parse(text);
  } catch {
    throw new Error(
      `PPQCHECK_BALANCE_INVALID_RESPONSE:${text}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `PPQCHECK_BALANCE_FAILED:${response.status}:${JSON.stringify(data)}`
    );
  }

  if (
    typeof data !== "object" ||
    data === null
  ) {
    throw new Error(
      "PPQCHECK_BALANCE_INVALID_DATA"
    );
  }

  const balanceData =
    data as Record<string, unknown>;

  const balance =
    Number(
      balanceData.balance ??
        balanceData.usdt_balance ??
        balanceData.usdtBalance ??
        0
    );

  if (!Number.isFinite(balance)) {
    throw new Error(
      "PPQCHECK_BALANCE_NOT_NUMERIC"
    );
  }

  return balance;
}

export async function getSyncCredit() {
  let syncCredit =
    await db.orm.public.SyncCredit
      .where({
        id: 1,
      })
      .first();

  if (!syncCredit) {
    console.log(
      "SyncCredit not initialized. Creating id=1."
    );

    syncCredit =
      await db.orm.public.SyncCredit.create({
        id: 1,

        ppqAmount:
          "0",

        ppqCoverage:
          "0",
      });

    console.log(
      "SyncCredit initialized:",
      {
        id:
          syncCredit.id,

        ppqAmount:
          String(
            syncCredit.ppqAmount
          ),

        ppqCoverage:
          String(
            syncCredit.ppqCoverage
          ),
      }
    );
  }

  return syncCredit;
}

async function createPpqcheckDeposit(
  amount: number
) {
  const apiKey =
    requireEnv(
      "PPQCHECK_API_KEY",
      PPQCHECK_API_KEY
    );

  const network =
    requireEnv(
      "PPQCHECK_NETWORK",
      PPQCHECK_NETWORK
    );

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "INVALID_PPQCHECK_DEPOSIT_AMOUNT"
    );
  }

  const body =
    JSON.stringify({
      amount,

      network,
    });

  console.log(
    "Creating PPQCheck USDT deposit:",
    {
      amount,

      network,
    }
  );

  const response =
    await fetch(
      `${PPQCHECK_API_BASE}/v1/integration/wallet/deposit-usdt`,
      {
        method: "POST",

        headers: {
          "X-API-Key":
            apiKey,

          "Content-Type":
            "application/json",
        },

        body,

        cache: "no-store",
      }
    );

  const text =
    await response.text();

  let data: unknown;

  try {
    data =
      JSON.parse(text);
  } catch {
    throw new Error(
      `PPQCHECK_DEPOSIT_INVALID_RESPONSE:${text}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `PPQCHECK_DEPOSIT_FAILED:${response.status}:${JSON.stringify(data)}`
    );
  }

  if (
    typeof data !== "object" ||
    data === null
  ) {
    throw new Error(
      "PPQCHECK_DEPOSIT_INVALID_DATA"
    );
  }

  const root =
    data as Record<string, unknown>;

  const depositData =
    (
      typeof root.data === "object" &&
      root.data !== null
    )
      ? root.data as Record<string, unknown>
      : root;

  const id =
    typeof depositData.id === "string"
      ? depositData.id
      : undefined;

  const address =
    typeof depositData.address === "string"
      ? depositData.address
      : undefined;

  const depositNetwork =
    typeof depositData.network === "string"
      ? depositData.network
      : undefined;

  const expiresAt =
    typeof depositData.expiresAt === "string"
      ? depositData.expiresAt
      : undefined;

  const amountUsdt =
    Number(
      depositData.amount_usdt
    );

  if (!address) {
    throw new Error(
      "PPQCHECK_DEPOSIT_ADDRESS_MISSING"
    );
  }

  if (
    !Number.isFinite(
      amountUsdt
    )
  ) {
    throw new Error(
      "PPQCHECK_DEPOSIT_AMOUNT_MISSING"
    );
  }

  if (
    Math.abs(
      amountUsdt -
        amount
    ) >
    0.000001
  ) {
    throw new Error(
      `PPQCHECK_DEPOSIT_AMOUNT_MISMATCH:${amountUsdt}:${amount}`
    );
  }

  console.log(
    "PPQCheck USDT deposit created:",
    {
      id,

      address,

      amountUsdt,

      network:
        depositNetwork ??
        network,

      expiresAt,
    }
  );

  return {
    id,

    address,

    amountUsdt,

    network:
      depositNetwork ??
      network,

    expiresAt,
  };
}

async function createPaymosWithdrawal(
  amount: number,
  destinationAddress: string,
  externalOrderId: string
) {
  const gatewayUrl =
    requireEnv(
      "PAYMOS_GATEWAY_URL",
      PAYMOS_GATEWAY_URL
    );

  const gatewaySecret =
    requireEnv(
      "PAYMOS_GATEWAY_SECRET",
      PAYMOS_GATEWAY_SECRET
    );

  const network =
    requireEnv(
      "PPQCHECK_NETWORK",
      PPQCHECK_NETWORK
    );

  if (
    network.toLowerCase() !==
    "binance"
  ) {
    throw new Error(
      "UNSUPPORTED_PPQCHECK_NETWORK"
    );
  }

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "INVALID_PAYMOS_WITHDRAWAL_AMOUNT"
    );
  }

  if (!destinationAddress) {
    throw new Error(
      "INVALID_PAYMOS_DESTINATION_ADDRESS"
    );
  }

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

  const response =
    await fetch(
      `${gatewayUrl}/paymos/withdrawals`,
      {
        method: "POST",

        headers: {
          "X-Gateway-Key":
            gatewaySecret,

          "Content-Type":
            "application/json",
        },

        body,

        cache: "no-store",
      }
    );

  const text =
    await response.text();

  let json:
    PaymosWithdrawalResponse = {};

  try {
    const parsed: unknown =
      JSON.parse(text);

    if (
      typeof parsed ===
        "object" &&
      parsed !== null
    ) {
      json =
        parsed as PaymosWithdrawalResponse;
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

async function getFundingTransaction(
  purchaseId: number
) {
  const transactions =
    await db.orm.public.PpqcheckTransaction
      .where({
        tokenPurchaseId:
          purchaseId,

        type:
          "ADJUSTMENT",
      })
      .all();

  return transactions[0] ?? null;
}

async function ensurePpqcheckFunding(
  operationAmount: number,
  externalOrderId: string,
  purchaseId: number,
  allowFailedFundingRetry = false
) {
  if (
    !Number.isFinite(
      operationAmount
    ) ||
    operationAmount <= 0
  ) {
    throw new Error(
      "INVALID_OPERATION_AMOUNT"
    );
  }

  const syncCredit =
    await getSyncCredit();

  const currentCoverage =
    Number(
      syncCredit.ppqCoverage
    );

  if (
    !Number.isFinite(
      currentCoverage
    )
  ) {
    throw new Error(
      "INVALID_SYNC_CREDIT_COVERAGE"
    );
  }

  const targetCoverage =
    currentCoverage +
    operationAmount;

  const actualBalance =
    await getPpqcheckBalance();

  console.log(
    "PPQCheck funding calculation:",
    {
      purchaseId,

      operationAmount,

      currentCoverage,

      targetCoverage,

      actualBalance,

      fundingNeeded:
        Math.max(
          0,
          targetCoverage -
            actualBalance
        ),
    }
  );

  const fundingAmount =
    Math.max(
      0,
      targetCoverage -
        actualBalance
    );

  if (
    fundingAmount <= 0
  ) {
    console.log(
      "PPQCheck funding not required:",
      {
        purchaseId,

        targetCoverage,

        actualBalance,
      }
    );

    return {
      status:
        "COMPLETED" as const,

      fundingAmount:
        0,

      targetCoverage,

      actualBalance,
    };
  }

  const existing =
    await getFundingTransaction(
      purchaseId
    );

  if (existing) {
    const metadata =
      parseFundingDescription(
        existing.description
      );

    if (
      metadata &&
      metadata.externalOrderId !==
        externalOrderId
    ) {
      throw new Error(
        "PPQCHECK_FUNDING_EXTERNAL_ORDER_MISMATCH"
      );
    }

    if (
      metadata?.status ===
      "PENDING"
    ) {
      if (
        metadata.withdrawalId
      ) {
        return {
          status:
            "PENDING" as const,

          fundingAmount:
            metadata.amount,

          targetCoverage,

          actualBalance,

          withdrawalId:
            metadata.withdrawalId,

          withdrawalStatus:
            metadata.withdrawalStatus,
        };
      }

      throw new Error(
        "PPQCHECK_FUNDING_PENDING_WITHOUT_WITHDRAWAL_ID"
      );
    }

    if (
      metadata?.status ===
      "COMPLETED"
    ) {
      return {
        status:
          "COMPLETED" as const,

        fundingAmount:
          metadata.amount,

        targetCoverage,

        actualBalance,

        withdrawalId:
          metadata.withdrawalId,

        withdrawalStatus:
          metadata.withdrawalStatus,
      };
    }

    if (
      metadata?.status ===
      "FAILED"
    ) {
      if (
        !allowFailedFundingRetry
      ) {
        throw new Error(
          "PPQCHECK_FUNDING_PREVIOUSLY_FAILED"
        );
      }

      console.log(
        "Authorized PPQCheck funding retry:",
        {
          purchaseId,

          externalOrderId,
        }
      );
    }
  }

  let deposit;

  try {
    deposit =
      await createPpqcheckDeposit(
        fundingAmount
      );
  } catch (error) {
    console.error(
      "PPQCheck deposit creation failed:",
      {
        purchaseId,

        fundingAmount,

        externalOrderId,

        error,
      }
    );

    throw error;
  }

  const metadata:
    FundingMetadata = {
    version: 3,

    status:
      "PENDING",

    externalOrderId,

    amount:
      fundingAmount,

    depositAddress:
      deposit.address,

    depositId:
      deposit.id,

    depositNetwork:
      deposit.network,

    depositExpiresAt:
      deposit.expiresAt,
  };

  const description =
    getFundingDescription(
      metadata
    );

  let transaction;

  if (!existing) {
    transaction =
      await db.orm.public.PpqcheckTransaction.create(
        {
          tokenPurchaseId:
            purchaseId,

          type:
            "ADJUSTMENT",

          amount:
            fundingAmount.toFixed(2),

          description,
        }
      );
  } else {
    await db.orm.public.PpqcheckTransaction
      .where({
        id:
          existing.id,
      })
      .update({
        amount:
          fundingAmount.toFixed(2),

        description,
      });

    transaction =
      await db.orm.public.PpqcheckTransaction
        .where({
          id:
            existing.id,
        })
        .first();
  }

  if (!transaction) {
    throw new Error(
      "PPQCHECK_TRANSACTION_NOT_FOUND_AFTER_CREATION"
    );
  }

  console.log(
    "Paymos PPQCheck funding:",
    {
      purchaseId,

      fundingAmount,

      externalOrderId,

      depositId:
        deposit.id,

      depositAddress:
        deposit.address,

      depositNetwork:
        deposit.network,

      depositExpiresAt:
        deposit.expiresAt,
    }
  );

  let withdrawal:
    PaymosWithdrawalResponse;

  try {
    withdrawal =
      await createPaymosWithdrawal(
        fundingAmount,

        deposit.address,

        externalOrderId
      );
  } catch (error) {
    const failedMetadata:
      FundingMetadata = {
      ...metadata,

      status:
        "FAILED",
    };

    await db.orm.public.PpqcheckTransaction
      .where({
        id:
          transaction.id,
      })
      .update({
        description:
          getFundingDescription(
            failedMetadata
          ),
      });

    throw error;
  }

  const withdrawalId =
    withdrawal.withdrawal_id;

  const withdrawalStatus =
    withdrawal.status;

  const pendingMetadata:
    FundingMetadata = {
    ...metadata,

    status:
      "PENDING",

    withdrawalId,

    withdrawalStatus,
  };

  await db.orm.public.PpqcheckTransaction
    .where({
      id:
        transaction.id,
    })
    .update({
      description:
        getFundingDescription(
          pendingMetadata
        ),
    });

  console.log(
    "Paymos PPQCheck funding withdrawal created:",
    {
      purchaseId,

      fundingAmount,

      withdrawalId,

      withdrawalStatus,

      depositId:
        deposit.id,

      depositAddress:
        deposit.address,

      depositNetwork:
        deposit.network,

      depositExpiresAt:
        deposit.expiresAt,
    }
  );

  return {
    status:
      "PENDING" as const,

    fundingAmount,

    targetCoverage,

    actualBalance,

    withdrawalId,

    withdrawalStatus,
  };
}

async function waitForPpqcheckCoverage(
  targetCoverage: number
) {
  for (
    let attempt = 0;
    attempt <
    PPQCHECK_BALANCE_POLL_ATTEMPTS;
    attempt++
  ) {
    const balance =
      await getPpqcheckBalance();

    console.log(
      "PPQCheck balance poll:",
      {
        attempt:
          attempt + 1,

        targetCoverage,

        balance,
      }
    );

    if (
      balance >=
      targetCoverage
    ) {
      return balance;
    }

    if (
      attempt <
      PPQCHECK_BALANCE_POLL_ATTEMPTS -
        1
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

  if (
    purchase.paymentStatus !==
      "PAID" &&
    purchase.paymentStatus !==
      "PAID_FUNDING"
  ) {
    if (
      purchase.paymentStatus ===
      "PAID_FUNDED"
    ) {
      return {
        purchaseId,

        tokens:
          purchase.tokens,
      };
    }

    throw new Error(
      "TOKEN_PURCHASE_NOT_PAID"
    );
  }

  const syncCredit =
    await getSyncCredit();

  const currentCoverage =
    Number(
      syncCredit.ppqCoverage
    );

  const currentAmount =
    Number(
      syncCredit.ppqAmount
    );

  if (
    !Number.isFinite(
      currentCoverage
    ) ||
    !Number.isFinite(
      currentAmount
    )
  ) {
    throw new Error(
      "INVALID_SYNC_CREDIT"
    );
  }

  const operationAmount =
    purchase.tokens *
    PPQCHECK_BUDGET_PER_TOKEN;

  const targetCoverage =
    currentCoverage +
    operationAmount;

  console.log(
    "Finalizing token purchase:",
    {
      purchaseId,

      tokens:
        purchase.tokens,

      operationAmount,

      currentCoverage,

      targetCoverage,
    }
  );

  const ppqBalance =
    await waitForPpqcheckCoverage(
      targetCoverage
    );

  await db.transaction(
    async (tx) => {
      const currentPurchase =
        await tx.orm.public.TokenPurchase
          .where({
            id:
              purchaseId,
          })
          .first();

      if (!currentPurchase) {
        throw new Error(
          "TOKEN_PURCHASE_NOT_FOUND"
        );
      }

      if (
        currentPurchase.paymentStatus ===
        "PAID_FUNDED"
      ) {
        return;
      }

      if (
        currentPurchase.paymentStatus !==
          "PAID" &&
        currentPurchase.paymentStatus !==
          "PAID_FUNDING"
      ) {
        throw new Error(
          "TOKEN_PURCHASE_NOT_PAID"
        );
      }

      const currentSyncCredit =
        await tx.orm.public.SyncCredit
          .where({
            id: 1,
          })
          .first();

      if (!currentSyncCredit) {
        throw new Error(
          "SYNC_CREDIT_NOT_INITIALIZED"
        );
      }

      const txCoverage =
        Number(
          currentSyncCredit.ppqCoverage
        );

      const txAmount =
        Number(
          currentSyncCredit.ppqAmount
        );

      if (
        !Number.isFinite(
          txCoverage
        ) ||
        !Number.isFinite(
          txAmount
        )
      ) {
        throw new Error(
          "INVALID_SYNC_CREDIT"
        );
      }

      const newCoverage =
        txCoverage +
        operationAmount;

      const newAmount =
        txAmount +
        operationAmount;

      const syncCreditUpdate =
        tx.sql.public.syncCredit
          .update((f, fns) => ({
            ppqAmount:
              fns.raw`${newAmount.toFixed(2)}`
                .returns("pg/numeric@1"),

            ppqCoverage:
              fns.raw`${newCoverage.toFixed(2)}`
                .returns("pg/numeric@1"),
          }))
          .where((f, fns) =>
            fns.eq(
              f.id,
              currentSyncCredit.id
            )
          )
          .build();

      await tx.execute(
        syncCreditUpdate
      );

      const userTokenBalanceUpdate =
        tx.sql.public.user
          .update((f, fns) => ({
            tokenBalance:
              fns.raw`${f.tokenBalance} + ${currentPurchase.tokens}`
                .returns("pg/int4@1"),
          }))
          .where((f, fns) =>
            fns.eq(
              f.id,
              currentPurchase.userId
            )
          )
          .build();

      await tx.execute(
        userTokenBalanceUpdate
      );

      await tx.orm.public.TokenTransaction
        .create({
          userId:
            currentPurchase.userId,

          amount:
            currentPurchase.tokens,

          type:
            "PURCHASE",

          purchaseId:
            currentPurchase.id,
        });

      await tx.orm.public.TokenPurchase
        .where({
          id:
            currentPurchase.id,
        })
        .update({
          paymentStatus:
            "PAID_FUNDED",
        });

      console.log(
        "Token purchase finalized:",
        {
          purchaseId:
            currentPurchase.id,

          userId:
            currentPurchase.userId,

          tokens:
            currentPurchase.tokens,

          newCoverage,

          newAmount,
        }
      );
    }
  );

  const finalBalance =
    await getPpqcheckBalance();

  if (
    finalBalance <
    targetCoverage
  ) {
    throw new Error(
      "PPQCHECK_BELOW_COVERAGE"
    );
  }

  return {
    purchaseId,

    tokens:
      purchase.tokens,

    targetCoverage,

    ppqBalance:
      Math.max(
        ppqBalance,
        finalBalance
      ),
  };
}

export async function processPaidTokenPurchase(
  purchaseId: number,
  options?: {
    allowFailedFundingRetry?: boolean;
  }
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

  const allowFailedFundingRetry =
    options?.allowFailedFundingRetry ===
    true;

  console.log(
    "Processing paid token purchase:",
    {
      purchaseId,

      userId:
        purchase.userId,

      tokens:
        purchase.tokens,

      amount:
        String(
          purchase.amount
        ),

      paymentStatus:
        purchase.paymentStatus,

      allowFailedFundingRetry,
    }
  );

  if (
    purchase.paymentStatus ===
    "PAID_FUNDED"
  ) {
    return {
      status:
        "COMPLETED" as const,

      purchaseId,

      tokens:
        purchase.tokens,
    };
  }

  if (
    purchase.paymentStatus ===
    "PAID_FUNDING_FAILED"
  ) {
    if (
      !allowFailedFundingRetry
    ) {
      throw new Error(
        "TOKEN_PURCHASE_FUNDING_FAILED"
      );
    }

    await db.orm.public.TokenPurchase
      .where({
        id:
          purchaseId,
      })
      .update({
        paymentStatus:
          "PAID_FUNDING",
      });

    console.log(
      "Authorized funding retry: purchase moved to PAID_FUNDING",
      {
        purchaseId,
      }
    );
  }

  const currentPurchase =
    await db.orm.public.TokenPurchase
      .where({
        id:
          purchaseId,
      })
      .first();

  if (!currentPurchase) {
    throw new Error(
      "TOKEN_PURCHASE_NOT_FOUND"
    );
  }

  if (
    currentPurchase.paymentStatus !==
      "PAID" &&
    currentPurchase.paymentStatus !==
      "PAID_FUNDING"
  ) {
    throw new Error(
      "TOKEN_PURCHASE_NOT_PAID"
    );
  }

  const externalOrderId =
    `onlysign_ppq_funding_${currentPurchase.id}`;

  const operationAmount =
    currentPurchase.tokens *
    PPQCHECK_BUDGET_PER_TOKEN;

  const funding =
    await ensurePpqcheckFunding(
      operationAmount,

      externalOrderId,

      currentPurchase.id,

      allowFailedFundingRetry
    );

  if (
    funding.status ===
    "PENDING"
  ) {
    console.log(
      "Paymos PPQCheck funding pending:",
      {
        purchaseId:
          currentPurchase.id,

        fundingAmount:
          funding.fundingAmount,

        withdrawalId:
          funding.withdrawalId,
      }
    );

    return {
      status:
        "PENDING" as const,

      purchaseId:
        currentPurchase.id,

      tokens:
        currentPurchase.tokens,

      fundingAmount:
        funding.fundingAmount,

      withdrawalId:
        funding.withdrawalId,
    };
  }

  const result =
    await finalizeTokenPurchase(
      currentPurchase.id
    );

  return {
    status:
      "COMPLETED" as const,

    ...result,
  };
}

export async function markFundingFailed(
  purchaseId: number
) {
  const transaction =
    await getFundingTransaction(
      purchaseId
    );

  if (!transaction) {
    throw new Error(
      "PPQCHECK_FUNDING_TRANSACTION_NOT_FOUND"
    );
  }

  const metadata =
    parseFundingDescription(
      transaction.description
    );

  if (!metadata) {
    throw new Error(
      "PPQCHECK_FUNDING_METADATA_INVALID"
    );
  }

  const failedMetadata:
    FundingMetadata = {
    ...metadata,

    status:
      "FAILED",
  };

  await db.orm.public.PpqcheckTransaction
    .where({
      id:
        transaction.id,
    })
    .update({
      description:
        getFundingDescription(
          failedMetadata
        ),
    });

  const purchase =
    await db.orm.public.TokenPurchase
      .where({
        id:
          purchaseId,
      })
      .first();

  if (
    purchase &&
    purchase.paymentStatus ===
    "PAID"
  ) {
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

  return {
    status:
      "FAILED" as const,

    purchaseId,
  };
}