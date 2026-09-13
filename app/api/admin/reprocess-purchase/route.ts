import { NextResponse } from "next/server";
import { processPaidTokenPurchase } from "@/lib/sync-credit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const purchaseId = Number(body.purchaseId);

    if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
      return NextResponse.json(
        { error: "Invalid purchaseId" },
        { status: 400 }
      );
    }

    console.log(
      "=== MANUAL TOKEN PURCHASE REPROCESS START ===",
      { purchaseId }
    );

    const result = await processPaidTokenPurchase(purchaseId);

    console.log(
      "=== MANUAL TOKEN PURCHASE REPROCESS RESULT ===",
      { purchaseId, result }
    );

    return NextResponse.json({
      ok: true,
      purchaseId,
      result,
    });
  } catch (error) {
    console.error(
      "=== MANUAL TOKEN PURCHASE REPROCESS ERROR ===",
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
      { status: 500 }
    );
  }
}