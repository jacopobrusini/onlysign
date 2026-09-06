import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getSession } from "@/lib/session";
import { generateEmailVerificationToken } from "@/lib/email-verification";
import { sendPasswordChangeEmail } from "@/lib/email";
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
            "Devi verificare il tuo indirizzo e-mail prima di modificare la password.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const currentPassword =
      typeof body.currentPassword === "string"
        ? body.currentPassword
        : "";

    const newPassword =
      typeof body.newPassword === "string"
        ? body.newPassword
        : "";

    const confirmPassword =
      typeof body.confirmPassword === "string"
        ? body.confirmPassword
        : "";

    if (!currentPassword) {
      return NextResponse.json(
        {
          field: "currentPassword",
          error: "Inserisci la password attuale.",
        },
        { status: 400 }
      );
    }

    const passwordCorrect = await argon2.verify(
      session.user.passwordHash,
      currentPassword
    );

    if (!passwordCorrect) {
      return NextResponse.json(
        {
          field: "currentPassword",
          error: "La password attuale non è corretta.",
        },
        { status: 400 }
      );
    }

    if (
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      return NextResponse.json(
        {
          field: "newPassword",
          error:
            "La nuova password deve contenere almeno 8 caratteri, una lettera maiuscola e un numero.",
        },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        {
          field: "confirmPassword",
          error: "Le password non coincidono.",
        },
        { status: 400 }
      );
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
    });

    const { token, tokenHash } =
      generateEmailVerificationToken();

    const expiresAt =
      Temporal.Now.instant().add({
        hours: 24,
      });

    await db.orm.public.PasswordChangeToken
      .where({
        userId: session.user.id,
      })
      .delete();

    await db.orm.public.PasswordChangeToken.create({
      tokenHash,
      userId: session.user.id,
      passwordHash,
      expiresAt,
    });

    await sendPasswordChangeEmail({
      email: session.user.email,
      username: session.user.username,
      token,
    });

    return NextResponse.json({
      success: true,
      message:
        "Ti abbiamo inviato un'e-mail per confermare la modifica della password.",
    });
  } catch (error) {
    console.error("Password change request error:", error);

    return NextResponse.json(
      {
        error:
          "Si è verificato un errore durante la richiesta.",
      },
      { status: 500 }
    );
  }
}