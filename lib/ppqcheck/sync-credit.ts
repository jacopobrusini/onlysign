import { db } from "@/prisma/db";

const PPQCHECK_BUDGET_PER_TOKEN = 1.4;

export async function getPpqcheckAccounting() {
  const purchases = await db.orm.public.TokenPurchase
    .where({
      status: "PAID",
    })
    .all();

  let totalPurchasedTokens = 0;

  for (const purchase of purchases) {
    totalPurchasedTokens += purchase.tokens;
  }

  const totalBudget =
    totalPurchasedTokens * PPQCHECK_BUDGET_PER_TOKEN;

  const certificateOrders = await db.orm.public.CertificateOrder
    .where({
      status: "SUCCESS",
    })
    .all();

  let actualCertificateCost = 0;
  let consumedTokens = 0;

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

    actualCertificateCost += Number(certificateType.ppqcheckCost);
    consumedTokens += order.tokens;
  }

  const unspentTokens = Math.max(
    0,
    totalPurchasedTokens - consumedTokens
  );

  const unspentTokenBudget =
    unspentTokens * PPQCHECK_BUDGET_PER_TOKEN;

  const coverage =
    actualCertificateCost + unspentTokenBudget;

  const margin = Math.max(
    0,
    totalBudget - coverage
  );

  return {
    totalPurchasedTokens,
    consumedTokens,
    unspentTokens,

    totalBudget,

    actualCertificateCost,
    unspentTokenBudget,

    coverage,

    margin,

    ppqcheckBudgetPerToken:
      PPQCHECK_BUDGET_PER_TOKEN,
  };
}