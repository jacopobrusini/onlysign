import { NextResponse } from "next/server";
import { syncCurrentSyncCredit } from "@/lib/sync-credit";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  const authorization = request.headers.get("authorization");
  const expectedAuthorization = `Bearer ${cronSecret}`;

  if (authorization !== expectedAuthorization) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const syncCredit = await syncCurrentSyncCredit();

    if (!syncCredit) {
      return NextResponse.json(
        { error: "SyncCredit record was not created" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      syncCredit: {
        id: syncCredit.id,
        ppqAmount: syncCredit.ppqAmount,
        ppqCoverage: syncCredit.ppqCoverage,
      },
    });
  } catch (error) {
    console.error("SyncCredit cron error:", error);

    return NextResponse.json(
      { error: "Failed to synchronize SyncCredit" },
      { status: 500 }
    );
  }
}