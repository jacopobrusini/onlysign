import { sendVerificationEmail } from "@/lib/email";
import { generateEmailVerificationToken } from "@/lib/email-verification";
import { NextResponse } from "next/server";
import argon2 from "argon2";
import { db } from "@/prisma/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const username =
      typeof body.username === "string"
        ? body.username.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const confirmPassword =
      typeof body.confirmPassword === "string"
        ? body.confirmPassword
        : "";

    const acceptedTerms = body.acceptedTerms === true;

    if (!username) {
      return NextResponse.json(
        { error: "Inserisci un username." },
        { status: 400 }
      );
    }

    if (username.length < 3 || username.length > 30) {
      return NextResponse.json(
        { error: "L'username deve avere tra 3 e 30 caratteri." },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        {
          error:
            "L'username può contenere solo lettere, numeri e underscore.",
        },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Inserisci un indirizzo email valido." },
        { status: 400 }
      );
    }

    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      return NextResponse.json(
        { error: "La password non soddisfa tutti i requisiti." },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Le password non coincidono." },
        { status: 400 }
      );
    }

    if (!acceptedTerms) {
      return NextResponse.json(
        { error: "Devi accettare i Termini e la Privacy Policy." },
        { status: 400 }
      );
    }

    const existingUsername =
      await db.orm.public.User.where({ username }).first();

    if (existingUsername) {
      return NextResponse.json(
        {
          field: "username",
          error: "Username già in uso.",
        },
        { status: 409 }
      );
    }

    const existingEmail =
      await db.orm.public.User.where({ email }).first();

    if (existingEmail) {
      return NextResponse.json(
        {
          field: "email",
          error: "Email già registrata.",
        },
        { status: 409 }
      );
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    const user = await db.orm.public.User.create({
      username,
      email,
      passwordHash,
      emailVerified: false,
    });

    const { token, tokenHash } = generateEmailVerificationToken();

const expiresAt = Temporal.Now.instant().add({
  hours: 24,
});

await db.orm.public.EmailVerificationToken.create({
  tokenHash,
  userId: user.id,
  expiresAt,
});

await sendVerificationEmail({
  email: user.email,
  username: user.username,
  token,
});

return NextResponse.json(
  {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified,
    },
  },
  { status: 201 }
);
  } catch (error) {
    console.error("Registration error:", error);

    return NextResponse.json(
      {
        error:
          "Si è verificato un errore durante la registrazione.",
      },
      { status: 500 }
    );
  }
}