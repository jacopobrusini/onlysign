import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/prisma/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token di verifica mancante." },
        { status: 400 }
      );
    }

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const verificationToken =
      await db.orm.public.EmailVerificationToken
        .where({ tokenHash })
        .first();

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Token di verifica non valido." },
        { status: 400 }
      );
    }

    if (Temporal.Now.instant() > verificationToken.expiresAt) {
      await db.orm.public.EmailVerificationToken
        .where({ id: verificationToken.id })
        .delete();

      return NextResponse.json(
        { error: "Il token di verifica è scaduto." },
        { status: 400 }
      );
    }

    await db.orm.public.User
      .where({ id: verificationToken.userId })
      .update({
        emailVerified: true,
      });

    await db.orm.public.EmailVerificationToken
      .where({ id: verificationToken.id })
      .delete();

    return NextResponse.json({
      success: true,
      message: "Email verificata con successo.",
    });
  } catch (error) {
    console.error("Email verification error:", error);

    return NextResponse.json(
      {
        error:
          "Si è verificato un errore durante la verifica dell'email.",
      },
      { status: 500 }
    );
  }
}