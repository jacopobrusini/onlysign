import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/prisma/db";

const SESSION_COOKIE_NAME = "onlysign_session";
const SESSION_DURATION_DAYS = 30;

function hashSessionToken(token: string) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const sessionTokenHash = hashSessionToken(token);

  const expiresAt = Temporal.Now.instant().add({
  seconds: SESSION_DURATION_DAYS * 24 * 60 * 60,
});

  await db.orm.public.Session.create({
    sessionTokenHash,
    userId,
    expiresAt,
  });

  const cookieStore = await cookies();

  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(
  expiresAt.epochMilliseconds
),
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const sessionTokenHash = hashSessionToken(token);

  const session =
    await db.orm.public.Session
      .where({ sessionTokenHash })
      .first();

  if (!session) {
    return null;
  }

  if (
  Temporal.Instant.compare(
    Temporal.Now.instant(),
    session.expiresAt
  ) > 0
) {
    await db.orm.public.Session
      .where({ id: session.id })
      .delete();

    return null;
  }

  const user =
    await db.orm.public.User
      .where({ id: session.userId })
      .first();

  if (!user) {
    await db.orm.public.Session
      .where({ id: session.id })
      .delete();

    return null;
  }

  return {
    session,
    user,
  };
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const sessionTokenHash = hashSessionToken(token);

    await db.orm.public.Session
      .where({ sessionTokenHash })
      .delete();
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}