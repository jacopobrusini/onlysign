import "temporal-polyfill/full/global";

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
  25;

const PPQCHECK_BALANCE_POLL_DELAYS_MS =
  [
    0,
    3000,
    5000,
    8000,
    12000,
    15000,
  ];

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

/*
 * Legge il saldo reale del wallet PPQCheck.
 *
 * Questo valore NON viene preso da SyncCredit:
 * SyncCredit è la contabilità interna di OnlySign,
 * mentre questo endpoint restituisce il saldo reale
 * disponibile sul wallet PPQCheck.
 */
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

  const text =
    await response.text();

  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `PPQCHECK_USDT_BALANCE_INVALID_RESPONSE:${text}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `PPQCHECK_USDT_BALANCE_FAILED:${response.status}:${JSON.stringify(data)}`
    );
  }

  if (
    typeof data !== "object" ||
    data === null
  ) {
    throw new Error(
      "PPQCHECK_USDT_BALANCE_INVALID_DATA"
    );
  }

  const root =
    data as Record<string, unknown>;

  const nestedData =
    typeof root.data === "object" &&
    root.data !== null
      ? root.data as Record<string, unknown>
      : root;

  const balance =
    Number(
      nestedData.availableBalance ??
      nestedData.balance ??
      0
    );

  if (!Number.isFinite(balance)) {
    throw new Error(
      "PPQCHECK_USDT_BALANCE_NOT_NUMERIC"
    );
  }

  return balance;
}

/*
 * Recupera o inizializza la contabilità interna
 * della copertura PPQCheck.
 */
export async function getSyncCredit() {
  let syncCredit =
    await db.orm.public.SyncCredit
      .where({
        id: 1,
      })
      .first();

  if (!syncCredit) {
    syncCredit =
      await db.orm.public.SyncCredit.create({
        id: 1,
        ppqAmount: "0",
        ppqCoverage: "0",
      });
  }

  return syncCredit;
}

/*
 * Calcola l'esposizione totale dei token che
 * OnlySign deve coprire su PPQCheck.
 *
 * Vengono considerati:
 *
 * 1. tutti i token già presenti nei saldi
 *    degli utenti;
 *
 * 2. tutti i token degli acquisti ancora
 *    presenti in TokenPurchase.
 *
 * I TokenPurchase già completati non vengono
 * più conteggiati perché vengono eliminati
 * e i relativi token sono già dentro User.tokenBalance.
 */
async function getTotalTokensToCover() {
  const users =
    await db.orm.public.User
      .all();

  const purchases =
    await db.orm.public.TokenPurchase
      .where({
        status: "PAID",
      })
      .all();

  const fundingPurchases =
    await db.orm.public.TokenPurchase
      .where({
        status: "PAID_FUNDING",
      })
      .all();

  let tokenBalanceTotal =
    0;

  for (
    const user of users
  ) {
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

    tokenBalanceTotal +=
      tokenBalance;
  }

  let purchaseTokenTotal =
    0;

  for (
    const purchase of [
      ...purchases,
      ...fundingPurchases,
    ]
  ) {
    const tokens =
      Number(
        purchase.tokens
      );

    if (
      !Number.isFinite(tokens) ||
      tokens <= 0
    ) {
      throw new Error(
        "INVALID_TOKEN_PURCHASE_TOKENS"
      );
    }

    purchaseTokenTotal +=
      tokens;
  }

  return {
    tokenBalanceTotal,

    purchaseTokenTotal,

    totalTokensToCover:
      tokenBalanceTotal +
      purchaseTokenTotal,
  };
}

/*
 * Chiede a PPQCheck di creare un deposito USDT
 * per l'importo necessario.
 */
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
      "INVALID_PPQCHECK_DEPOSIT_AMOUNT"
    );
  }

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
          amount,
          network,
        }),

        cache: "no-store",
      }
    );

  const text =
    await response.text();

  let data: unknown;

  try {
    data = JSON.parse(text);
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

  if (
    root.code !== undefined &&
    Number(root.code) !== 201
  ) {
    throw new Error(
      `PPQCHECK_DEPOSIT_UNEXPECTED_CODE:${String(root.code)}`
    );
  }

  const depositData =
    typeof root.data === "object" &&
    root.data !== null
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

  if (!id) {
    throw new Error(
      "PPQCHECK_DEPOSIT_ID_MISSING"
    );
  }

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
    amountUsdt < amount
  ) {
    throw new Error(
      `PPQCHECK_DEPOSIT_AMOUNT_TOO_LOW:${amountUsdt}:${amount}`
    );
  }

  const resolvedNetwork =
    depositNetwork ?? network;

  if (
    resolvedNetwork.toLowerCase() !==
    "binance"
  ) {
    throw new Error(
      `PPQCHECK_DEPOSIT_UNSUPPORTED_NETWORK:${resolvedNetwork}`
    );
  }

  return {
    id,

    address,

    amountUsdt,

    network:
      resolvedNetwork,

    expiresAt,
  };
}

/*
 * Chiede al gateway Paymos di effettuare
 * il trasferimento USDT verso il deposito PPQCheck.
 */
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

        body: JSON.stringify({
          amount:
            amount.toFixed(2),

          currency: "USDT",

          network: "BEP20",

          destination_address:
            destinationAddress,

          external_order_id:
            externalOrderId,
        }),

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

/*
 * Recupera il record tecnico temporaneo
 * che rappresenta il funding PPQCheck
 * di un determinato acquisto.
 */
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

/*
 * Determina se il saldo PPQCheck disponibile
 * copre l'esposizione totale dei token.
 *
 * Il nuovo acquisto viene considerato insieme
 * a tutti gli altri TokenPurchase ancora esistenti
 * e a tutti gli User.tokenBalance.
 *
 * Se il margine disponibile è sufficiente
 * per l'intera nuova operazione:
 *
 *   nessun withdrawal.
 *
 * Se invece il margine è insufficiente:
 *
 *   withdrawal = operationAmount
 *
 * Non viene mai effettuato un micro-deposito
 * della sola differenza.
 */
async function ensurePpqcheckFunding(
  operationAmount: number,
  externalOrderId: string,
  purchaseId: number
) {
  const existing =
    await getFundingTransaction(
      purchaseId
    );

  if (existing) {
    if (
      existing.externalOrderId &&
      existing.externalOrderId !==
        externalOrderId
    ) {
      throw new Error(
        "PPQCHECK_FUNDING_EXTERNAL_ORDER_MISMATCH"
      );
    }

    if (
      existing.fundingStatus ===
      "PENDING"
    ) {
      if (
        !existing.paymosWithdrawalId
      ) {
        throw new Error(
          "PPQCHECK_FUNDING_PENDING_WITHOUT_WITHDRAWAL_ID"
        );
      }

      return {
        status:
          "PENDING" as const,

        fundingAmount:
          Number(
            existing.amount
          ),

        withdrawalId:
          existing.paymosWithdrawalId,

        withdrawalStatus:
          existing.paymosWithdrawalStatus ??
          undefined,
      };
    }

    if (
      existing.fundingStatus ===
      "COMPLETED"
    ) {
      return {
        status:
          "COMPLETED" as const,

        fundingAmount:
          Number(
            existing.amount
          ),

        withdrawalId:
          existing.paymosWithdrawalId ??
          undefined,

        withdrawalStatus:
          existing.paymosWithdrawalStatus ??
          undefined,
      };
    }

    if (
      existing.fundingStatus ===
      "FAILED"
    ) {
      await db.orm.public.PpqcheckTransaction
        .where({
          id:
            existing.id,
        })
        .delete();
    }
  }

  const exposure =
    await getTotalTokensToCover();

  const requiredCoverage =
    exposure.totalTokensToCover *
    PPQCHECK_BUDGET_PER_TOKEN;

  const actualBalance =
    await getPpqcheckBalance();

  const margin =
    actualBalance -
    requiredCoverage;

  /*
   * Il saldo PPQCheck copre già
   * l'intera nuova operazione.
   *
   * Non viene effettuato alcun withdrawal.
   */
  if (
    margin >= operationAmount
  ) {
    return {
      status:
        "COMPLETED" as const,

      fundingAmount:
        0,

      totalTokensToCover:
        exposure.totalTokensToCover,

      tokenBalanceTotal:
        exposure.tokenBalanceTotal,

      purchaseTokenTotal:
        exposure.purchaseTokenTotal,

      requiredCoverage,

      actualBalance,

      margin,
    };
  }

  /*
   * Il margine non è sufficiente.
   *
   * Viene finanziato l'intero importo
   * dell'operazione, non soltanto la differenza.
   */
  const fundingAmount =
    operationAmount;

  const deposit =
    await createPpqcheckDeposit(
      fundingAmount
    );

  const transaction =
    await db.orm.public.PpqcheckTransaction.create({
      tokenPurchaseId:
        purchaseId,

      type:
        "ADJUSTMENT",

      amount:
        fundingAmount.toFixed(2),

      description:
        "PPQCheck USDT funding",

      fundingStatus:
        "PENDING",

      externalOrderId,

      ppqDepositId:
        deposit.id,

      ppqDepositAddress:
        deposit.address,

      ppqDepositAmount:
        deposit.amountUsdt.toFixed(2),

      ppqDepositNetwork:
        deposit.network,

      ppqDepositExpiresAt:
        deposit.expiresAt
          ? Temporal.Instant.from(
              deposit.expiresAt
            )
          : null,
    });

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
    await db.orm.public.PpqcheckTransaction
      .where({
        id:
          transaction.id,
      })
      .delete();

    throw error;
  }

  const withdrawalId =
    withdrawal.withdrawal_id;

  if (!withdrawalId) {
    await db.orm.public.PpqcheckTransaction
      .where({
        id:
          transaction.id,
      })
      .delete();

    throw new Error(
      "PAYMOS_WITHDRAWAL_ID_MISSING"
    );
  }

  await db.orm.public.PpqcheckTransaction
    .where({
      id:
        transaction.id,
    })
    .update({
      paymosWithdrawalId:
        withdrawalId,

      paymosWithdrawalStatus:
        withdrawal.status ??
        null,
    });

  return {
    status:
      "PENDING" as const,

    fundingAmount,

    totalTokensToCover:
      exposure.totalTokensToCover,

    tokenBalanceTotal:
      exposure.tokenBalanceTotal,

    purchaseTokenTotal:
      exposure.purchaseTokenTotal,

    requiredCoverage,

    actualBalance,

    margin,

    withdrawalId,

    withdrawalStatus:
      withdrawal.status,
  };
}

/*
 * Aspetta che il saldo reale PPQCheck
 * raggiunga la copertura richiesta.
 */
async function waitForPpqcheckCoverage(
  targetCoverage: number
) {
  let lastBalance = 0;

  for (
    let attempt = 0;

    attempt <
    PPQCHECK_BALANCE_POLL_ATTEMPTS;

    attempt++
  ) {
    const balance =
      await getPpqcheckBalance();

    lastBalance =
      balance;

    if (
      balance >=
      targetCoverage
    ) {
      return {
        visible:
          true,

        balance,
      };
    }

    if (
      attempt <
      PPQCHECK_BALANCE_POLL_ATTEMPTS -
        1
    ) {
      const delay =
        PPQCHECK_BALANCE_POLL_DELAYS_MS[
          Math.min(
            attempt + 1,

            PPQCHECK_BALANCE_POLL_DELAYS_MS.length -
              1
          )
        ];

      await sleep(delay);
    }
  }

  return {
    visible:
      false,

    balance:
      lastBalance,
  };
}

/*
 * Finalizza l'acquisto.
 *
 * Operazioni atomiche:
 *
 * 1. aggiorna SyncCredit
 * 2. incrementa User.tokenBalance
 * 3. elimina PpqcheckTransaction
 * 4. elimina TokenPurchase
 *
 * NON viene creata una TokenTransaction PURCHASE.
 */
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

  /*
   * Se il purchase non esiste più,
   * l'operazione è già stata completata
   * oppure rimossa.
   *
   * Questo rende i retry idempotenti.
   */
  if (!purchase) {
    return {
      status:
        "COMPLETED" as const,

      purchaseId,
    };
  }

  if (
    purchase.status !==
      "PAID" &&
    purchase.status !==
      "PAID_FUNDING"
  ) {
    throw new Error(
      "TOKEN_PURCHASE_NOT_PAID"
    );
  }

  const operationAmount =
    purchase.tokens *
    PPQCHECK_BUDGET_PER_TOKEN;

  const exposure =
    await getTotalTokensToCover();

  const requiredCoverage =
    exposure.totalTokensToCover *
    PPQCHECK_BUDGET_PER_TOKEN;

  /*
   * Verifica il saldo reale PPQCheck.
   *
   * Se il funding è stato effettuato,
   * aspettiamo che il saldo raggiunga
   * la copertura richiesta.
   *
   * Se invece il saldo era già sufficiente,
   * questa verifica termina immediatamente.
   */
  const ppqBalance =
    await waitForPpqcheckCoverage(
      requiredCoverage
    );

  /*
   * Se il funding non è ancora visibile
   * sul saldo PPQCheck, manteniamo il purchase
   * in PAID_FUNDING.
   */
  if (
    !ppqBalance.visible
  ) {
    await db.orm.public.TokenPurchase
      .where({
        id:
          purchaseId,
      })
      .update({
        status:
          "PAID_FUNDING",
      });

    return {
      status:
        "PENDING" as const,

      purchaseId,

      tokens:
        purchase.tokens,

      operationAmount,

      totalTokensToCover:
        exposure.totalTokensToCover,

      requiredCoverage,

      ppqBalance:
        ppqBalance.balance,
    };
  }

  /*
   * Tutto è coperto.
   *
   * Ora aggiorniamo la contabilità e
   * accreditiamo i token nella stessa
   * transazione database.
   */
  await db.transaction(
    async (tx) => {
      const currentPurchase =
        await tx.orm.public.TokenPurchase
          .where({
            id:
              purchaseId,
          })
          .first();

      /*
       * Un'altra richiesta ha già completato
       * l'ordine.
       */
      if (!currentPurchase) {
        return;
      }

      if (
        currentPurchase.status !==
          "PAID" &&
        currentPurchase.status !==
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

      /*
       * Aggiorna la copertura interna
       * PPQCheck.
       */
      const syncCreditUpdate =
        tx.sql.public.syncCredit
          .update((f, fns) => ({
            ppqAmount:
              fns.raw`${newAmount.toFixed(2)}`
                .returns(
                  "pg/numeric@1"
                ),

            ppqCoverage:
              fns.raw`${newCoverage.toFixed(2)}`
                .returns(
                  "pg/numeric@1"
                ),
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

      /*
       * Accredita i token all'utente.
       */
      const userTokenBalanceUpdate =
        tx.sql.public.user
          .update((f, fns) => ({
            tokenBalance:
              fns.raw`${f.tokenBalance} + ${currentPurchase.tokens}`
                .returns(
                  "pg/int4@1"
                ),
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

      /*
       * Elimina il record tecnico temporaneo
       * del funding PPQCheck.
       */
      const fundingTransaction =
        await tx.orm.public.PpqcheckTransaction
          .where({
            tokenPurchaseId:
              currentPurchase.id,

            type:
              "ADJUSTMENT",
          })
          .first();

      if (fundingTransaction) {
        await tx.orm.public.PpqcheckTransaction
          .where({
            id:
              fundingTransaction.id,
          })
          .delete();
      }

      /*
       * Il TokenPurchase non è uno storico.
       * Una volta completato viene eliminato.
       */
      await tx.orm.public.TokenPurchase
        .where({
          id:
            currentPurchase.id,
        })
        .delete();
    }
  );

  return {
    status:
      "COMPLETED" as const,

    purchaseId,

    tokens:
      purchase.tokens,

    totalTokensToCover:
      exposure.totalTokensToCover,

    requiredCoverage,

    ppqBalance:
      ppqBalance.balance,
  };
}

/*
 * Processo principale di un acquisto pagato.
 */
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

  /*
   * Acquisto già completato/eliminato.
   */
  if (!purchase) {
    return {
      status:
        "COMPLETED" as const,

      purchaseId,
    };
  }

  if (
    purchase.status !== "PAID" &&
    purchase.status !==
      "PAID_FUNDING"
  ) {
    throw new Error(
      "TOKEN_PURCHASE_NOT_PAID"
    );
  }

  const externalOrderId =
    `onlysign_ppq_funding_${purchase.id}`;

  const operationAmount =
    purchase.tokens *
    PPQCHECK_BUDGET_PER_TOKEN;

  /*
   * Verifica il saldo PPQCheck e,
   * se necessario, crea il funding.
   */
  const funding =
    await ensurePpqcheckFunding(
      operationAmount,

      externalOrderId,

      purchase.id
    );

  /*
   * Funding ancora in corso.
   */
  if (
    funding.status ===
    "PENDING"
  ) {
    await db.orm.public.TokenPurchase
      .where({
        id:
          purchase.id,
      })
      .update({
        status:
          "PAID_FUNDING",
      });

    return {
      status:
        "PENDING" as const,

      purchaseId:
        purchase.id,

      tokens:
        purchase.tokens,

      fundingAmount:
        funding.fundingAmount,

      withdrawalId:
        funding.withdrawalId,
    };
  }

  /*
   * Non serve altro funding:
   * verifichiamo la copertura reale
   * e finalizziamo.
   */
  return finalizeTokenPurchase(
    purchase.id
  );
}

/*
 * Gestisce un funding fallito.
 *
 * Il funding e il purchase sono entrambi
 * dati temporanei e vengono eliminati.
 */
export async function markFundingFailed(
  purchaseId: number
) {
  await db.transaction(
    async (tx) => {
      const fundingTransaction =
        await tx.orm.public.PpqcheckTransaction
          .where({
            tokenPurchaseId:
              purchaseId,

            type:
              "ADJUSTMENT",
          })
          .first();

      if (fundingTransaction) {
        await tx.orm.public.PpqcheckTransaction
          .where({
            id:
              fundingTransaction.id,
          })
          .delete();
      }

      await tx.orm.public.TokenPurchase
        .where({
          id:
            purchaseId,
        })
        .delete();
    }
  );

  return {
    status:
      "FAILED" as const,

    purchaseId,
  };
}