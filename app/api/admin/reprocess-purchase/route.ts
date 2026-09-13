import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { processPaidTokenPurchase } from "@/lib/sync-credit";

export async function POST(request: Request) {
  try {
    const recoverySecret =
      request.headers.get(
        "x-recovery-secret"
      );

    if (
      !recoverySecret ||
      recoverySecret !==
        process.env.PURCHASE_RECOVERY_SECRET
    ) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const purchaseId =
      Number(body.purchaseId);

    if (
      !Number.isInteger(
        purchaseId
      ) ||
      purchaseId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid purchaseId",
        },
        {
          status: 400,
        }
      );
    }

    const purchase =
      await db.orm.public.TokenPurchase
        .where({
          id:
            purchaseId,
        })
        .first();

    if (!purchase) {
      return NextResponse.json(
        {
          error:
            "Purchase not found",
        },
        {
          status: 404,
        }
      );
    }

    if (
      purchase.status !==
      "PAID"
    ) {
      return NextResponse.json(
        {
          error:
            "Purchase is not confirmed as paid",
          status:
            purchase.status,
        },
        {
          status: 409,
        }
      );
    }

    if (
      purchase.paymentStatus ===
      "PAID_FUNDED"
    ) {
      return NextResponse.json({
        ok: true,

        alreadyCompleted:
          true,

        purchaseId,
      });
    }

    if (
      purchase.paymentStatus !==
        "PAID" &&
      purchase.paymentStatus !==
        "PAID_FUNDING" &&
      purchase.paymentStatus !==
        "PAID_FUNDING_FAILED"
    ) {
      return NextResponse.json(
        {
          error:
            "Purchase is not eligible for recovery",

          paymentStatus:
            purchase.paymentStatus,
        },
        {
          status: 409,
        }
      );
    }

    console.log(
      "=== AUTHORIZED PURCHASE RECOVERY START ===",
      {
        purchaseId,

        status:
          purchase.status,

        paymentStatus:
          purchase.paymentStatus,
      }
    );

    const result =
      await processPaidTokenPurchase(
        purchaseId,
        {
          allowFailedFundingRetry:
            true,
        }
      );

    console.log(
      "=== AUTHORIZED PURCHASE RECOVERY RESULT ===",
      {
        purchaseId,

        result,
      }
    );

    return NextResponse.json({
      ok: true,

      purchaseId,

      result,
    });
  } catch (error) {
    console.error(
      "=== AUTHORIZED PURCHASE RECOVERY ERROR ===",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 500,
      }
    );
  }
}