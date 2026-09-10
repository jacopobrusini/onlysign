import { db } from "@/prisma/db";

const PPQCHECK_API_URL = "https://api-developer.dev";

function getApiKey() {
  const apiKey = process.env.PPQCHECK_API_KEY;

  if (!apiKey) {
    throw new Error("PPQCHECK_API_KEY non configurata");
  }

  return apiKey;
}

async function getPpqcheckBalance(): Promise<number> {
  const response = await fetch(
    `${PPQCHECK_API_URL}/v1/integration/balance`,
    {
      method: "GET",
      headers: {
        "X-API-Key": getApiKey(),
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `PPQCheck balance error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  const balance = Number(
    data.balance ??
      data.usdtBalance ??
      data.amount ??
      data.data?.balance ??
      data.data?.usdtBalance
  );

  if (!Number.isFinite(balance)) {
    throw new Error("Saldo PPQCheck non valido");
  }

  return balance;
}

export async function getPpqcheckAccounting() {
  const purchases = await db.orm.public.TokenPurchase
    .where({
      status: "PAID",
    })
    .all();

  let totalBudget = 0;

  for (const purchase of purchases) {
    const packages = await db.orm.public.TokenPackage
      .where({
        id: purchase.packageId,
      })
      .all();

    const tokenPackage = packages[0];

    if (!tokenPackage) {
      continue;
    }

    totalBudget += Number(tokenPackage.ppqcheckBudget);
  }

  const certificateOrders = await db.orm.public.CertificateOrder
    .where({
      status: "SUCCESS",
    })
    .all();

  let totalCertificateCost = 0;

  for (const order of certificateOrders) {
    const certificateTypes = await db.orm.public.CertificateType
      .where({
        id: order.certificateTypeId,
      })
      .all();

    const certificateType = certificateTypes[0];

    if (!certificateType) {
      continue;
    }

    totalCertificateCost += Number(certificateType.ppqcheckCost);
  }

  const transactions = await db.orm.public.PpqcheckTransaction
    .where({
      type: "TOKEN_CREDIT",
    })
    .all();

  let totalDeposited = 0;

  for (const transaction of transactions) {
    totalDeposited += Number(transaction.amount);
  }

  const balance = await getPpqcheckBalance();

  const theoreticalCredit =
    totalBudget - totalCertificateCost;

  const pendingCredit =
    theoreticalCredit - balance;

  return {
    balance,
    totalBudget,
    totalCertificateCost,
    theoreticalCredit,
    totalDeposited,
    pendingCredit: Math.max(0, pendingCredit),
    needsDeposit: pendingCredit > 0,
  };
}