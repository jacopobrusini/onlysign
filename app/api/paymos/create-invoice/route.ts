import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/prisma/db";
import { getSession } from "@/lib/session";

const PAYMOS_API_URL = "https://api.paymos.io/v1/invoices";

type PaymosInvoiceResponse = {
  data?: {
    invoice_id?: string;
    payment_url?: string;
  };
  invoice_id?: string;
  payment_url?: string;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Non autenticato" },
        { status: 401 }
      );
    }

    let body: { packageId?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Richiesta non valida" },
        { status: 400 }
      );
    }

    const packageId = Number(body.packageId);

    if (!Number.isInteger(packageId) || packageId <= 0) {
      return NextResponse.json(
        { error: "Pacchetto non valido" },
        { status: 400 }
      );
    }

    const packages = await db.orm.public.TokenPackage
      .where({
        id: packageId,
        active: true,
      })
      .all();

    const tokenPackage = packages[0];

    if (!tokenPackage) {
      return NextResponse.json(
        { error: "Pacchetto non trovato" },
        { status: 404 }
      );
    }

    const apiKey = process.env.PAYMOS_API_KEY;
    const apiSecret = process.env.PAYMOS_API_SECRET;
    const projectId = process.env.PAYMOS_PROJECT_ID;

    if (!apiKey || !apiSecret || !projectId) {
      console.error(
        "Paymos: configurazione API incompleta"
      );

      return NextResponse.json(
        { error: "Configurazione pagamento non disponibile" },
        { status: 500 }
      );
    }

    const amount = Number(tokenPackage.price);

    if (!Number.isFinite(amount) || amount <= 0) {
      console.error(
        "Paymos: prezzo pacchetto non valido",
        tokenPackage.id
      );

      return NextResponse.json(
        { error: "Prezzo pacchetto non valido" },
        { status: 500 }
      );
    }

    const paymosOrderId =
      `onlysign_purchase_${crypto.randomUUID()}`;

    const purchase = await db.orm.public.TokenPurchase.create({
      userId: session.user.id,
      packageId: tokenPackage.id,
      tokens: tokenPackage.tokens,
      amount: tokenPackage.price,
      paymentId: paymosOrderId,
      paymosOrderId,
      status: "PENDING",
    });

    const paymosBody = JSON.stringify({
      project_id: projectId,
      amount: amount.toFixed(2),
      currency: "EUR",
      external_order_id: paymosOrderId,
      client_id: `user_${session.user.id}`,
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();

    const bodyHash = crypto
      .createHash("sha256")
      .update(paymosBody)
      .digest("hex");

    const stringToSign = [
      timestamp,
      "POST",
      "/v1/invoices",
      "",
      bodyHash,
    ].join("\n");

    const signature = crypto
      .createHmac("sha256", apiSecret)
      .update(stringToSign)
      .digest("base64");

    const response = await fetch(PAYMOS_API_URL, {
      method: "POST",
      headers: {
        Authorization:
          `HMAC-SHA256 ${apiKey}:${signature}`,
        "X-Request-Timestamp": timestamp,
        "Content-Type": "application/json",
      },
      body: paymosBody,
    });

    const responseText = await response.text();

    let paymosResponse: PaymosInvoiceResponse = {};

    try {
      paymosResponse =
        JSON.parse(responseText) as PaymosInvoiceResponse;
    } catch {
      console.error(
        "Paymos: risposta non JSON",
        response.status,
        responseText
      );
    }

    if (!response.ok) {
      console.error(
        "Paymos invoice creation failed:",
        response.status,
        responseText
      );

      return NextResponse.json(
        {
          error:
            "Impossibile creare il pagamento Paymos",
        },
        { status: 502 }
      );
    }

    const invoiceId =
      paymosResponse.data?.invoice_id ??
      paymosResponse.invoice_id;

    const paymentUrl =
      paymosResponse.data?.payment_url ??
      paymosResponse.payment_url;

    if (!invoiceId || !paymentUrl) {
      console.error(
        "Paymos: risposta incompleta",
        paymosResponse
      );

      return NextResponse.json(
        { error: "Risposta Paymos non valida" },
        { status: 502 }
      );
    }

    await db.orm.public.TokenPurchase
      .where({
        id: purchase.id,
      })
      .update({
        paymentId: invoiceId,
      });

    return NextResponse.json({
      success: true,
      paymentUrl,
      invoiceId,
      purchaseId: purchase.id,
    });
  } catch (error) {
    console.error(
      "Paymos create invoice error:",
      error
    );

    return NextResponse.json(
      { error: "Errore interno" },
      { status: 500 }
    );
  }
}