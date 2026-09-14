import { NextResponse } from "next/server";

import { db } from "@/prisma/db";
import {
  finalizeTokenPurchase,
} from "@/lib/sync-credit";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request
) {
  const cronSecret =
    process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error(
      "CRON_SECRET_MISSING"
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "CRON_SECRET_MISSING",
      },
      {
        status: 500,
      }
    );
  }

  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    authorization !==
    `Bearer ${cronSecret}`
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "UNAUTHORIZED",
      },
      {
        status: 401,
      }
    );
  }

  console.log(
    "PPQCheck cron started."
  );

  const purchases =
    await db.orm.public.TokenPurchase
      .where({
        status: "PAID_FUNDING",
      })
      .all();

  console.log(
    "PPQCheck cron pending purchases:",
    {
      count:
        purchases.length,
    }
  );

  const results = [];

  for (
    const purchase of purchases
  ) {
    try {
      console.log(
        "PPQCheck cron processing purchase:",
        {
          purchaseId:
            purchase.id,

          userId:
            purchase.userId,

          tokens:
            purchase.tokens,
        }
      );

      const result =
        await finalizeTokenPurchase(
          purchase.id
        );

      results.push({
        purchaseId:
          purchase.id,

        status:
          result.status ??
          "COMPLETED",

        result,
      });
    } catch (error) {
      console.error(
        "PPQCheck cron purchase error:",
        {
          purchaseId:
            purchase.id,

          error,
        }
      );

      results.push({
        purchaseId:
          purchase.id,

        status:
          "ERROR",

        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }

  console.log(
    "PPQCheck cron finished:",
    {
      processed:
        results.length,
    }
  );

  return NextResponse.json({
    ok: true,

    processed:
      results.length,

    results,
  });
}