import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST() {
  try {
    await deleteSession();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Logout error:", error);

    return NextResponse.json(
      {
        error: "Si è verificato un errore durante il logout.",
      },
      { status: 500 }
    );
  }
}