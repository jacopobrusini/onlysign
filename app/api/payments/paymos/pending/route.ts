import "temporal-polyfill/full/global";

import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getSession } from "@/lib/session";

const PENDING_EXPIRATION_MS =
  45 * 60 * 1000;

const PROCESSING_EXPIRATION_MS =
  2 * 60 * 60 * 1000;

async function deletePurchase(
  purchaseId: number
) {
  const fundingTransactions =
    await db.orm.public.PpqcheckTransaction
      .where({
        tokenPurchaseId:
          purchaseId,
      })
      .all();

  for (
    const transaction of
    fundingTransactions
  ) {
    await db.orm.public.PpqcheckTransaction
      .where({
        id:
          transaction.id,
      })
      .delete();
  }

  await db.orm.public.TokenPurchase
    .where({
      id:
        purchaseId,
    })
    .delete();
}

export async function GET() {
  try {
    const session =
      await getSession();

    if (!session) {
      return NextResponse.json(
        {
          error:
            "Non autenticato",
        },
        {
          status: 401,
        }
      );
    }

    const purchases =
      await db.orm.public.TokenPurchase
        .where({
          userId:
            session.user.id,
        })
        .all();

    const now =
      Temporal.Now.instant();

    for (
      const purchase of purchases
    ) {
      const age =
        now.epochMilliseconds -
        purchase.createdAt
          .epochMilliseconds;

      const expiration =
        purchase.status ===
        "PENDING"
          ? PENDING_EXPIRATION_MS
          : PROCESSING_EXPIRATION_MS;

      if (
        age <
        expiration
      ) {
        continue;
      }

      console.log(
        "Expired token purchase deleted:",
        {
          purchaseId:
            purchase.id,

          status:
            purchase.status,
        }
      );

      await deletePurchase(
        purchase.id
      );
    }

    const refreshedPurchases =
      await db.orm.public.TokenPurchase
        .where({
          userId:
            session.user.id,
        })
        .all();

    const result = [];

    for (
      const purchase of
      refreshedPurchases
    ) {
      const transactions =
        await db.orm.public.PpqcheckTransaction
          .where({
            tokenPurchaseId:
              purchase.id,
          })
          .all();

      const transaction =
        transactions[0] ??
        null;

      result.push({
        id:
          purchase.id,

        tokens:
          purchase.tokens,

        amount:
          Number(
            purchase.amount
          ),

        status:
          purchase.status,

        fundingStatus:
          transaction?.fundingStatus ??
          null,

        paymosWithdrawalStatus:
          transaction?.paymosWithdrawalStatus ??
          null,
      });
    }

    result.sort(
      (a, b) =>
        b.id -
        a.id
    );

    return NextResponse.json({
      success: true,

      purchases:
        result,
    });
  } catch (error) {
    console.error(
      "Paymos pending purchases error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Errore interno",
      },
      {
        status: 500,
      }
    );
  }
}