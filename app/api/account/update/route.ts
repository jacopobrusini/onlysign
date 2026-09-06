import { NextResponse } from "next/server";

import { db } from "@/prisma/db";
import { getSession } from "@/lib/session";
import { generateEmailVerificationToken } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        {
          error: "Non sei autenticato.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const username =
      typeof body.username === "string"
        ? body.username.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    /* =========================
       VALIDAZIONE USERNAME
       ========================= */

    if (!username) {
      return NextResponse.json(
        {
          field: "username",
          error: "Inserisci un nome profilo.",
        },
        { status: 400 }
      );
    }

    if (username.length < 3 || username.length > 30) {
      return NextResponse.json(
        {
          field: "username",
          error:
            "Il nome profilo deve avere tra 3 e 30 caratteri.",
        },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        {
          field: "username",
          error:
            "Il nome profilo può contenere solo lettere, numeri e underscore.",
        },
        { status: 400 }
      );
    }

    /* =========================
       VALIDAZIONE EMAIL
       ========================= */

    if (!email) {
      return NextResponse.json(
        {
          field: "email",
          error: "Inserisci un indirizzo e-mail.",
        },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        {
          field: "email",
          error: "Inserisci un indirizzo e-mail valido.",
        },
        { status: 400 }
      );
    }

    /* =========================
       CONTROLLO USERNAME
       ========================= */

    const existingUsername =
      await db.orm.public.User
        .where({ username })
        .first();

    if (
      existingUsername &&
      existingUsername.id !== session.user.id
    ) {
      return NextResponse.json(
        {
          field: "username",
          error: "Nome profilo già in uso.",
        },
        { status: 409 }
      );
    }

    /* =========================
       CONTROLLO EMAIL
       ========================= */

    const emailChanged =
      email !== session.user.email;

    if (emailChanged) {
      const existingEmail =
        await db.orm.public.User
          .where({ email })
          .first();

      if (
        existingEmail &&
        existingEmail.id !== session.user.id
      ) {
        return NextResponse.json(
          {
            field: "email",
            error:
              "Questa e-mail è già associata a un account.",
          },
          { status: 409 }
        );
      }
    }

    /* =========================
       AGGIORNAMENTO ACCOUNT
       ========================= */

    const updatedUser =
      await db.orm.public.User
        .where({ id: session.user.id })
        .update({
          username,
          email,
          ...(emailChanged
            ? {
                emailVerified: false,
              }
            : {}),
        });

    if (!updatedUser) {
      return NextResponse.json(
        {
          error:
            "Impossibile aggiornare l'account.",
        },
        { status: 500 }
      );
    }

    /* =========================
       NUOVA VERIFICA EMAIL
       ========================= */

    if (emailChanged) {
      const { token, tokenHash } =
        generateEmailVerificationToken();

      const expiresAt =
        Temporal.Now.instant().add({
          hours: 24,
        });

      await db.orm.public.EmailVerificationToken
        .where({
          userId: session.user.id,
        })
        .delete();

      await db.orm.public.EmailVerificationToken.create({
        tokenHash,
        userId: session.user.id,
        expiresAt,
      });

      await sendVerificationEmail({
        email,
        username,
        token,
      });
    }

    return NextResponse.json({
      success: true,
      emailChanged,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        emailVerified: updatedUser.emailVerified,
      },
    });
  } catch (error) {
    console.error(
      "Account update error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Si è verificato un errore durante l'aggiornamento dell'account.",
      },
      { status: 500 }
    );
  }
}