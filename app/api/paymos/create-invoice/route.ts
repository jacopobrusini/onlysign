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
    console.log(
      "=== PAYMOS CREATE INVOICE START ==="
    );

    const session = await getSession();

    if (!session) {
      console.log(
        "Paymos create invoice: unauthenticated request"
      );

      return NextResponse.json(
        { error: "Non autenticato" },
        { status: 401 }
      );
    }

    let body: { packageId?: unknown };

    try {
      body = await request.json();
    } catch {
      console.error(
        "Paymos create invoice: invalid JSON"
      );

      return NextResponse.json(
        { error: "Richiesta non valida" },
        { status: 400 }
      );
    }

    const packageId = Number(body.packageId);

    console.log(
      "Paymos create invoice request:",
      {
        userId: session.user.id,
        packageId,
      }
    );

    if (
      !Number.isInteger(packageId) ||
      packageId <= 0
    ) {
      console.error(
        "Paymos create invoice: invalid packageId",
        {
          packageId,
        }
      );

      return NextResponse.json(
        { error: "Pacchetto non valido" },
        { status: 400 }
      );
    }

    const packages =
      await db.orm.public.TokenPackage
        .where({
          id: packageId,
          active: true,
        })
        .all();

    const tokenPackage = packages[0];

    if (!tokenPackage) {
      console.error(
        "Paymos create invoice: package not found",
        {
          packageId,
        }
      );

      return NextResponse.json(
        { error: "Pacchetto non trovato" },
        { status: 404 }
      );
    }

    const apiKey =
      process.env.PAYMOS_API_KEY;

    const apiSecret =
      process.env.PAYMOS_API_SECRET;

    const projectId =
      process.env.PAYMOS_PROJECT_ID;

    if (
      !apiKey ||
      !apiSecret ||
      !projectId
    ) {
      console.error(
        "Paymos: configurazione API incompleta"
      );

      return NextResponse.json(
        {
          error:
            "Configurazione pagamento non disponibile",
        },
        { status: 500 }
      );
    }

    const amount =
      Number(tokenPackage.price);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      console.error(
        "Paymos: prezzo pacchetto non valido",
        {
          packageId: tokenPackage.id,
          price: tokenPackage.price,
        }
      );

      return NextResponse.json(
        {
          error:
            "Prezzo pacchetto non valido",
        },
        { status: 500 }
      );
    }

    const paymosOrderId =
      `onlysign_purchase_${crypto.randomUUID()}`;

    console.log(
      "Paymos create invoice: creating purchase",
      {
        userId: session.user.id,
        packageId: tokenPackage.id,
        tokens: tokenPackage.tokens,
        amount,
        paymosOrderId,
      }
    );

    const purchase =
      await db.orm.public.TokenPurchase.create({
        userId: session.user.id,
        packageId: tokenPackage.id,
        tokens: tokenPackage.tokens,
        amount: tokenPackage.price,
        paymentId: paymosOrderId,
        paymosOrderId,
        status: "PENDING",
      });

    console.log(
      "Paymos TokenPurchase created:",
      {
        purchaseId: purchase.id,
        userId: session.user.id,
        packageId: tokenPackage.id,
        tokens: tokenPackage.tokens,
        amount: tokenPackage.price,
        paymosOrderId,
      }
    );

    const paymosBody =
      JSON.stringify({
        project_id: projectId,
        amount: amount.toFixed(2),
        currency: "EUR",
        external_order_id:
          paymosOrderId,
        client_id:
          `user_${session.user.id}`,
      });

    const timestamp =
      Math.floor(Date.now() / 1000).toString();

    const bodyHash =
      crypto
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

    const signature =
      crypto
        .createHmac(
          "sha256",
          apiSecret
        )
        .update(stringToSign)
        .digest("base64");

    console.log(
      "Paymos invoice request:",
      {
        purchaseId: purchase.id,
        paymosOrderId,
        amount: amount.toFixed(2),
        currency: "EUR",
        projectId,
      }
    );

    const response =
      await fetch(PAYMOS_API_URL, {
        method: "POST",
        headers: {
          Authorization:
            `HMAC-SHA256 ${apiKey}:${signature}`,
          "X-Request-Timestamp":
            timestamp,
          "Content-Type":
            "application/json",
        },
        body: paymosBody,
      });

    const responseText =
      await response.text();

    console.log(
      "Paymos invoice API response:",
      {
        purchaseId: purchase.id,
        paymosOrderId,
        status: response.status,
        ok: response.ok,
        body: responseText,
      }
    );

    let paymosResponse:
      PaymosInvoiceResponse = {};

    try {
      paymosResponse =
        JSON.parse(
          responseText
        ) as PaymosInvoiceResponse;
    } catch {
      console.error(
        "Paymos: risposta non JSON",
        {
          status: response.status,
          body: responseText,
        }
      );
    }

    if (!response.ok) {
      console.error(
        "Paymos invoice creation failed:",
        {
          purchaseId: purchase.id,
          paymosOrderId,
          status: response.status,
          response: responseText,
        }
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

    if (
      !invoiceId ||
      !paymentUrl
    ) {
      console.error(
        "Paymos: risposta incompleta",
        {
          purchaseId: purchase.id,
          paymosOrderId,
          response: paymosResponse,
        }
      );

      return NextResponse.json(
        {
          error:
            "Risposta Paymos non valida",
        },
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

    console.log(
      "Paymos invoice created successfully:",
      {
        purchaseId: purchase.id,
        paymosOrderId,
        invoiceId,
        amount: amount.toFixed(2),
        currency: "EUR",
        paymentUrl,
      }
    );

    console.log(
      "=== PAYMOS CREATE INVOICE SUCCESS ===",
      {
        purchaseId: purchase.id,
        invoiceId,
        paymosOrderId,
      }
    );

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
      {
        error: "Errore interno",
      },
      {
        status: 500,
      }
    );
  }
}