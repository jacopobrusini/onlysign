import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getSession } from "@/lib/session";
import { generateEmailVerificationToken } from "@/lib/email-verification";
import { sendAccountDeletionEmail } from "@/lib/email";
import argon2 from "argon2";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Non sei autenticato." },
        { status: 401 }
      );
    }

    if (!session.user.emailVerified) {
      return NextResponse.json(
        {
          error:
            "Devi verificare il tuo indirizzo e-mail prima di eliminare l'account.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!password) {
      return NextResponse.json(
        {
          field: "password",
          error: "Inserisci la password attuale.",
        },
        { status: 400 }
      );
    }

    const passwordCorrect = await argon2.verify(
      session.user.passwordHash,
      password
    );

    if (!passwordCorrect) {
      return NextResponse.json(
        {
          field: "password",
          error: "La password attuale non è corretta.",
        },
        { status: 400 }
      );
    }

    const { token, tokenHash } =
      generateEmailVerificationToken();

    const expiresAt =
      Temporal.Now.instant().add({
        hours: 24,
      });

    await db.orm.public.AccountDeletionToken
      .where({
        userId: session.user.id,
      })
      .delete();

    await db.orm.public.AccountDeletionToken.create({
      tokenHash,
      userId: session.user.id,
      expiresAt,
    });

    await sendAccountDeletionEmail({
      email: session.user.email,
      username: session.user.username,
      token,
    });

    return NextResponse.json({
      success: true,
      message:
        "Ti abbiamo inviato un'e-mail per confermare l'eliminazione dell'account.",
    });
  } catch (error) {
    console.error(
      "Account deletion request error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Si è verificato un errore durante la richiesta di eliminazione.",
      },
      { status: 500 }
    );
  }
}