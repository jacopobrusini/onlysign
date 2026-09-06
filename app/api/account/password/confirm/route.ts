import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { createSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token di conferma mancante." },
        { status: 400 }
      );
    }

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const passwordChangeToken =
      await db.orm.public.PasswordChangeToken
        .where({ tokenHash })
        .first();

    if (!passwordChangeToken) {
      return NextResponse.json(
        {
          error: "Token non valido o già utilizzato.",
        },
        { status: 400 }
      );
    }

    if (
      Temporal.Instant.compare(
        Temporal.Now.instant(),
        passwordChangeToken.expiresAt
      ) > 0
    ) {
      await db.orm.public.PasswordChangeToken
        .where({ id: passwordChangeToken.id })
        .delete();

      return NextResponse.json(
        {
          error: "Il link di conferma è scaduto.",
        },
        { status: 400 }
      );
    }

    await db.orm.public.User
      .where({
        id: passwordChangeToken.userId,
      })
      .update({
        passwordHash: passwordChangeToken.passwordHash,
      });

    await db.orm.public.PasswordChangeToken
      .where({
        id: passwordChangeToken.id,
      })
      .delete();

    await db.orm.public.Session
      .where({
        userId: passwordChangeToken.userId,
      })
      .delete();

    await createSession(passwordChangeToken.userId);

    return NextResponse.json({
      success: true,
      message: "Password modificata con successo.",
    });
  } catch (error) {
    console.error("Password confirmation error:", error);

    return NextResponse.json(
      {
        error:
          "Si è verificato un errore durante la conferma.",
      },
      { status: 500 }
    );
  }
}