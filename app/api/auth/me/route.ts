import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { authenticated: false },
        { status: 200 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user.id,
        username: session.user.username,
        email: session.user.email,
        emailVerified: session.user.emailVerified,
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);

    return NextResponse.json(
      { authenticated: false },
      { status: 200 }
    );
  }
}