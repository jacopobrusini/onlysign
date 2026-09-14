import "temporal-polyfill/full/global";

import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getSession } from "@/lib/session";

const PENDING_EXPIRATION_MS =
  45 * 60 * 1000;

export async function GET() {
  try {
    const session =
      await getSession();

    if (!session) {
      return NextResponse.json(
        {
          error: "Non autenticato",
        },
        {
          status: 401,
        }
      );
    }

    const purchases =
      await db.orm.public.TokenPurchase
        .where({
          userId: session.user.id,
        })
        .all();

    const now =
      Temporal.Now.instant();

    for (const purchase of purchases) {
      if (
        purchase.paymentStatus !==
        "PENDING"
      ) {
        continue;
      }

      const age =
        now.epochMilliseconds -
        purchase.createdAt.epochMilliseconds;

      if (
        age <
        PENDING_EXPIRATION_MS
      ) {
        continue;
      }

      const transactions =
        await db.orm.public.PpqcheckTransaction
          .where({
            tokenPurchaseId:
              purchase.id,
          })
          .all();

      const hasFundingTransaction =
        transactions.length > 0;

      if (
        hasFundingTransaction
      ) {
        continue;
      }

      await db.orm.public.TokenPurchase
        .where({
          id: purchase.id,
        })
        .delete();

      console.log(
        "Expired pending Paymos purchase deleted:",
        {
          purchaseId: purchase.id,
          createdAt:
            purchase.createdAt.toString(),
        }
      );
    }

    const refreshedPurchases =
      await db.orm.public.TokenPurchase
        .where({
          userId: session.user.id,
        })
        .all();

    const pendingPurchases =
      refreshedPurchases
        .filter(
          (purchase) =>
            purchase.paymentStatus !==
            "PAID_FUNDED"
        )
        .sort(
          (a, b) =>
            Number(b.id) -
            Number(a.id)
        );

    const result = [];

    for (const purchase of pendingPurchases) {
      const transactions =
        await db.orm.public.PpqcheckTransaction
          .where({
            tokenPurchaseId:
              purchase.id,
          })
          .all();

      const transaction =
        transactions[0] ?? null;

      result.push({
        id: purchase.id,

        tokens:
          purchase.tokens,

        amount:
          Number(purchase.amount),

        status:
          purchase.status,

        paymentStatus:
          purchase.paymentStatus,

        fundingStatus:
          transaction?.fundingStatus ??
          null,

        paymosWithdrawalStatus:
          transaction?.paymosWithdrawalStatus ??
          null,
      });
    }

    return NextResponse.json({
      success: true,
      purchases: result,
    });
  } catch (error) {
    console.error(
      "Paymos pending purchases error:",
      error
    );

    return NextResponse.json(
      {
        error: "Errore interno",
      },
      {
        status: 500,
      }
    );
  }
}