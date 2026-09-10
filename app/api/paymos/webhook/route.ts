import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    const signatureHeader = request.headers.get("x-webhook-signature");
    const timestampHeader = request.headers.get("x-webhook-timestamp");

    if (!signatureHeader || !timestampHeader) {
      console.error("Paymos webhook: missing signature headers");

      return NextResponse.json(
        { error: "Missing webhook signature headers" },
        { status: 401 }
      );
    }

    const webhookSecret = process.env.PAYMOS_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("Paymos webhook: PAYMOS_WEBHOOK_SECRET is not configured");

      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    const timestamp = Number(timestampHeader);

    if (!Number.isInteger(timestamp)) {
      console.error("Paymos webhook: invalid timestamp");

      return NextResponse.json(
        { error: "Invalid webhook timestamp" },
        { status: 401 }
      );
    }

    // Reject webhooks older/newer than 5 minutes.
    const now = Math.floor(Date.now() / 1000);

    if (Math.abs(now - timestamp) > 300) {
      console.error("Paymos webhook: timestamp outside tolerance");

      return NextResponse.json(
        { error: "Webhook timestamp expired" },
        { status: 401 }
      );
    }

    const signaturePayload = `${timestamp}.${rawBody}`;

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(signaturePayload)
      .digest("hex");

    // Paymos may temporarily provide multiple v1 signatures during
    // webhook secret rotation.
    const signatures = signatureHeader
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.startsWith("v1="))
      .map((part) => part.slice(3));

    const signatureValid = signatures.some((signature) => {
      if (!/^[a-fA-F0-9]{64}$/.test(signature)) {
        return false;
      }

      try {
        return crypto.timingSafeEqual(
          Buffer.from(signature, "hex"),
          Buffer.from(expectedSignature, "hex")
        );
      } catch {
        return false;
      }
    });

    if (!signatureValid) {
      console.error("Paymos webhook: invalid signature");

      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    let payload: any;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error("Paymos webhook: invalid JSON");

      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const eventId = payload?.event_id;
    const eventType = payload?.event_type;

    if (!eventId || !eventType) {
      console.error("Paymos webhook: missing event data");

      return NextResponse.json(
        { error: "Missing event data" },
        { status: 400 }
      );
    }

    console.log("=== PAYMOS WEBHOOK VERIFIED ===");
    console.log("Event ID:", eventId);
    console.log("Event type:", eventType);
    console.log("Timestamp:", timestamp);
    console.log("Signature: VALID");
    console.log("Payload:", payload);

    // TESTING ONLY:
    // We currently do not modify the database or credit tokens.
    //
    // Later:
    // - verify event idempotency
    // - find TokenPurchase using external/payment ID
    // - verify invoice status
    // - mark purchase as PAID
    // - credit tokens
    // - create TokenTransaction
    // - handle refunds/failures safely

    return NextResponse.json({
      received: true,
      verified: true,
    });
  } catch (error) {
    console.error("Paymos webhook error:", error);

    return NextResponse.json(
      { error: "Internal webhook error" },
      { status: 500 }
    );
  }
}