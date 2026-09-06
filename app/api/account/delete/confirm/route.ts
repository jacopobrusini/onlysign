import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { deleteSession } from "@/lib/session";

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

    const deletionToken =
      await db.orm.public.AccountDeletionToken
        .where({ tokenHash })
        .first();

    if (!deletionToken) {
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
        deletionToken.expiresAt
      ) > 0
    ) {
      await db.orm.public.AccountDeletionToken
        .where({ id: deletionToken.id })
        .delete();

      return NextResponse.json(
        {
          error: "Il link di conferma è scaduto.",
        },
        { status: 400 }
      );
    }

    const userId = deletionToken.userId;

    const sessions =
  await db.orm.public.Session
    .where({ userId })
    .all();

for (const session of sessions) {
  await db.orm.public.Session
    .where({ id: session.id })
    .delete();
}

    await db.orm.public.EmailVerificationToken
      .where({ userId })
      .delete();

    await db.orm.public.PasswordChangeToken
      .where({ userId })
      .delete();

    await db.orm.public.AccountDeletionToken
      .where({ userId })
      .delete();

    await db.orm.public.User
      .where({ id: userId })
      .delete();

    await deleteSession();

    return NextResponse.json({
      success: true,
      message: "Account eliminato definitivamente.",
    });
  } catch (error) {
    console.error(
      "Account deletion confirmation error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Si è verificato un errore durante l'eliminazione dell'account.",
      },
      { status: 500 }
    );
  }
}