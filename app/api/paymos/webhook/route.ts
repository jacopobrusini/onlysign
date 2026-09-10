import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  console.log("=== PAYMOS WEBHOOK ===");

  console.log("X-Webhook-Id:", request.headers.get("x-webhook-id"));
  console.log(
    "X-Webhook-Timestamp:",
    request.headers.get("x-webhook-timestamp")
  );
  console.log(
    "X-Webhook-Signature:",
    request.headers.get("x-webhook-signature")
  );

  console.log("Raw body:", rawBody);

  try {
    console.log("Payload:", JSON.parse(rawBody));
  } catch {
    console.log("Payload non JSON");
  }

  return NextResponse.json({ received: true });
}