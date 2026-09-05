import { NextResponse } from "next/server";
import argon2 from "argon2";

import { db } from "@/prisma/db";
import { createSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!email || !password) {
      return NextResponse.json(
        {
          error: "Inserisci email e password.",
        },
        { status: 400 }
      );
    }

    const user =
      await db.orm.public.User
        .where({ email })
        .first();

    if (!user) {
      return NextResponse.json(
        {
          error: "Email o password non corrette.",
        },
        { status: 401 }
      );
    }

    const passwordValid = await argon2.verify(
      user.passwordHash,
      password
    );

    if (!passwordValid) {
      return NextResponse.json(
        {
          error: "Email o password non corrette.",
        },
        { status: 401 }
      );
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        {
          error:
            "Devi prima verificare il tuo indirizzo email.",
        },
        { status: 403 }
      );
    }

    await createSession(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      {
        error: "Si è verificato un errore durante il login.",
      },
      { status: 500 }
    );
  }
}