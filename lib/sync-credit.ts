import crypto from "crypto";
import { db } from "@/prisma/db";

const PPQCHECK_API_BASE = "https://br.api-developer.dev";

const PPQCHECK_NETWORK = "binance";

const PPQCHECK_ADDRESS =
  process.env.PPQCHECK_USDT_ADDRESS;

const PPQCHECK_API_KEY =
  process.env.PPQCHECK_API_KEY;

const PAYMOS_API_BASE =
  "https://api.paymos.io/v1";

const PAYMOS_PAYOUT_KEY =
  process.env.PAYMOS_PAYOUT_KEY;

const PAYMOS_API_SECRET =
  process.env.PAYMOS_API_SECRET;

const PPQCHECK_BUDGET_PER_TOKEN = 1.4;

export {
  PPQCHECK_BUDGET_PER_TOKEN,
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

async function createPpqcheckDeposit(
  amount: number
) {
  const apiKey =
    requireEnv(
      "PPQCHECK_API_KEY",
      PPQCHECK_API_KEY
    );

  const address =
    requireEnv(
      "PPQCHECK_USDT_ADDRESS",
      PPQCHECK_ADDRESS
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
          amount,
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

  return {
    id: deposit.id,
    address: deposit.address,
    amountUsdt:
      Number(
        deposit.amount_usdt
      ),
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
          .createHash("sha256")
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
    .update(stringToSign)
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

  const json =
    await response.json();

  if (!response.ok) {
    throw new Error(
      `PAYMOS_WITHDRAWAL_FAILED:${response.status}:${JSON.stringify(json)}`
    );
  }

  return json;
}

export async function getSyncCredit() {
  const syncCredit =
    await db.orm.public.SyncCredit
      .where({
        id: 1,
      })
      .first();

  if (!syncCredit) {
    throw new Error(
      "SYNC_CREDIT_NOT_INITIALIZED"
    );
  }

  const ppqAmount =
    await getPpqcheckBalance();

  const ppqCoverage =
    Number(
      syncCredit.ppqCoverage
    );

  if (
    !Number.isFinite(
      ppqCoverage
    )
  ) {
    throw new Error(
      "INVALID_SYNC_CREDIT"
    );
  }

  return {
    id: syncCredit.id,

    ppqAmount,

    ppqCoverage,

    availableCredit:
      ppqAmount -
      ppqCoverage,
  };
}

export async function ensurePpqcheckFunding(
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

  const availableCredit =
    syncCredit.availableCredit;

  console.log(
    "SyncCredit check",
    {
      ppqAmount:
        syncCredit.ppqAmount,

      ppqCoverage:
        syncCredit.ppqCoverage,

      availableCredit,

      operationAmount,
    }
  );

  if (
    availableCredit >=
    operationAmount
  ) {
    return {
      funded: false,

      ppqAmount:
        syncCredit.ppqAmount,

      ppqCoverage:
        syncCredit.ppqCoverage,

      availableCredit,

      fundingAmount: 0,
    };
  }

  const fundingAmount =
    operationAmount;

  const deposit =
    await createPpqcheckDeposit(
      fundingAmount
    );

  const withdrawal =
    await createPaymosWithdrawal(
      fundingAmount,
      deposit.address,
      externalOrderId
    );

  return {
    funded: true,

    ppqAmount:
      syncCredit.ppqAmount,

    ppqCoverage:
      syncCredit.ppqCoverage,

    availableCredit,

    fundingAmount,

    depositId:
      deposit.id,

    ppqcheckAddress:
      deposit.address,

    withdrawalId:
      withdrawal?.withdrawal_id,

    withdrawalStatus:
      withdrawal?.status,
  };
}