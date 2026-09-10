import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/prisma/db";

const WEBHOOK_TOLERANCE_SECONDS = 300;

type PaymosWebhookPayload = {
  event_id?: string;
  event_type?: string;
  version?: number;
  occurred_at?: number;
  data?: {
    invoice_id?: string;
    status?: string;
    is_final?: boolean;
    is_test?: boolean;
    order?: {
      external_id?: string;
      client_id?: string;
      amount?: string;
      currency?: string;
    };
    payment?: {
      currency?: string;
      network?: string;
      expected?: string;
      paid?: string;
      remaining?: string;
      fee?: string;
      net?: string;
    };
  };
};

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function verifyWebhookSignature(
  signatureHeader: string,
  rawBody: string,
  secret: string
) {
  const parts = signatureHeader.split(",");

  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=", 2);

    if (key === "t" && value) {
      timestamp = value;
    }

    if (key === "v1" && value) {
      signatures.push(value);
    }
  }

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const timestampNumber = Number(timestamp);

  if (!Number.isInteger(timestampNumber)) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);

  if (
    Math.abs(now - timestampNumber) >
    WEBHOOK_TOLERANCE_SECONDS
  ) {
    return false;
  }

  const signedPayload =
    `${timestampNumber}.${rawBody}`;

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(signedPayload)
      .digest("hex");

  return signatures.some((signature) =>
    safeEqual(signature, expectedSignature)
  );
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret =
      process.env.PAYMOS_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error(
        "Paymos webhook: PAYMOS_WEBHOOK_SECRET missing"
      );

      return NextResponse.json(
        { error: "Webhook non configurato" },
        { status: 500 }
      );
    }

    const rawBody = await request.text();

console.log(
  "Paymos webhook TEST payload:",
  rawBody
);

    const signatureHeader =
      request.headers.get("x-webhook-signature");

    if (!signatureHeader) {
      return NextResponse.json(
        { error: "Firma mancante" },
        { status: 401 }
      );
    }

    const validSignature =
      verifyWebhookSignature(
        signatureHeader,
        rawBody,
        webhookSecret
      );

    if (!validSignature) {
      return NextResponse.json(
        { error: "Firma non valida" },
        { status: 401 }
      );
    }

    let payload: PaymosWebhookPayload;

    try {
      payload =
        JSON.parse(rawBody) as PaymosWebhookPayload;
    } catch {
      return NextResponse.json(
        { error: "Payload non valido" },
        { status: 400 }
      );
    }

    const eventId =
      payload.event_id ??
      request.headers.get("x-webhook-id");

    const eventType =
      payload.event_type;

    if (!eventId || !eventType) {
      return NextResponse.json(
        { error: "Evento non valido" },
        { status: 400 }
      );
    }

    /*
     * Tutta la gestione dell'evento avviene
     * nella stessa transazione.
     *
     * In questo modo:
     *
     * - l'evento viene salvato
     * - l'acquisto viene marcato PAID
     * - il saldo token viene incrementato
     * - la TokenTransaction viene creata
     *
     * oppure non viene salvato nulla.
     */

    const result = await db.transaction(async (tx) => {
      /*
       * Deduplicazione dell'evento.
       */

      const existingEvents =
        await tx.orm.public.PaymosWebhookEvent
          .where({
            eventId,
          })
          .all();

      if (existingEvents.length > 0) {
        return {
          duplicate: true,
          processed: true,
        };
      }

      /*
       * Salviamo l'evento verificato.
       *
       * Se successivamente qualcosa fallisce,
       * la transazione viene annullata e Paymos
       * potrà ritentare il webhook.
       */

      await tx.orm.public.PaymosWebhookEvent.create({
        eventId,
        eventType,
      });

      /*
       * Gestiamo soltanto gli eventi terminali
       * di pagamento riuscito.
       */

      if (
        eventType !== "invoice.paid" &&
        eventType !== "invoice.paid_over"
      ) {
        return {
          duplicate: false,
          processed: false,
        };
      }

      const data = payload.data;

      if (!data) {
        console.error(
          "Paymos webhook: data mancante",
          eventId
        );

        return {
          duplicate: false,
          processed: false,
        };
      }

      /*
       * Il pagamento è valido solamente se:
       *
       * status = paid
       * is_final = true
       */

      if (
        data.status !== "paid" ||
        data.is_final !== true
      ) {
        console.warn(
          "Paymos webhook: stato non finale",
          {
            eventId,
            eventType,
            status: data.status,
            isFinal: data.is_final,
          }
        );

        return {
          duplicate: false,
          processed: false,
        };
      }

      /*
       * external_id è l'identificativo creato
       * da onlySign durante la creazione dell'invoice.
       */

      const externalOrderId =
        data.order?.external_id;

      if (!externalOrderId) {
        console.error(
          "Paymos webhook: external_order_id mancante",
          eventId
        );

        return {
          duplicate: false,
          processed: false,
        };
      }

      /*
       * Troviamo l'acquisto onlySign.
       */

      const purchases =
        await tx.orm.public.TokenPurchase
          .where({
            paymosOrderId: externalOrderId,
          })
          .all();

      const purchase = purchases[0];

      if (!purchase) {
        console.error(
          "Paymos webhook: TokenPurchase non trovata",
          {
            eventId,
            externalOrderId,
          }
        );

        return {
          duplicate: false,
          processed: false,
        };
      }

      /*
       * Verifichiamo importo e valuta fiat.
       *
       * Non utilizziamo l'importo crypto,
       * perché quello dipende dal cambio Paymos.
       */

      const orderAmount =
        Number(data.order?.amount);

      const purchaseAmount =
        Number(purchase.amount);

      const orderCurrency =
        data.order?.currency;

      if (
        !Number.isFinite(orderAmount) ||
        !Number.isFinite(purchaseAmount) ||
        orderCurrency !== "EUR" ||
        Math.abs(orderAmount - purchaseAmount) >
          0.01
      ) {
        console.error(
          "Paymos webhook: importo o valuta non corrispondenti",
          {
            eventId,
            purchaseId: purchase.id,
            expectedAmount: purchaseAmount,
            receivedAmount: orderAmount,
            receivedCurrency: orderCurrency,
          }
        );

        return {
          duplicate: false,
          processed: false,
        };
      }

      /*
       * Claim atomico dell'acquisto.
       *
       * Cambiamo PENDING -> PAID solamente se
       * l'acquisto è ancora PENDING.
       *
       * Se due webhook arrivano contemporaneamente,
       * solamente uno dei due potrà effettuare
       * questo aggiornamento.
       */

      const claimedPurchase =
        await tx.orm.public.TokenPurchase
          .where({
            id: purchase.id,
            status: "PENDING",
          })
          .update({
            status: "PAID",
            paymentStatus: "PAID",
          });

      if (!claimedPurchase) {
        /*
         * Un altro webhook ha già processato
         * questo acquisto.
         */

        return {
          duplicate: false,
          processed: true,
          alreadyPaid: true,
          purchaseId: purchase.id,
          tokens: purchase.tokens,
        };
      }

      /*
       * Verifichiamo che l'utente esista.
       */

      const users =
        await tx.orm.public.User
          .where({
            id: purchase.userId,
          })
          .all();

      const user = users[0];

      if (!user) {
        throw new Error(
          `Paymos webhook: utente non trovato: ${purchase.userId}`
        );
      }

      /*
       * Incremento atomico del saldo token.
       *
       * Non facciamo:
       *
       * user.tokenBalance + purchase.tokens
       *
       * perché due acquisti contemporanei potrebbero
       * leggere lo stesso saldo.
       *
       * PostgreSQL esegue invece:
       *
       * tokenBalance = tokenBalance + N
       *
       * direttamente sul database.
       */

      const incrementPlan =
  tx.sql.public.user
    .update((f, fns) => ({
      tokenBalance:
        fns.raw`${f.tokenBalance} + ${purchase.tokens}`
          .returns("pg/int4@1"),
    }))
    .where((f, fns) =>
      fns.eq(f.id, purchase.userId)
    )
    .returning("id", "tokenBalance")
    .build();

await tx.execute(incrementPlan);

      /*
       * Registriamo la transazione contabile.
       *
       * purchaseId è UNIQUE nel database.
       */

      await tx.orm.public.TokenTransaction.create({
        userId: purchase.userId,
        amount: purchase.tokens,
        type: "PURCHASE",
        purchaseId: purchase.id,
      });

      console.log(
        "Paymos webhook: token accreditati",
        {
          eventId,
          purchaseId: purchase.id,
          userId: purchase.userId,
          tokens: purchase.tokens,
        }
      );

      return {
        duplicate: false,
        processed: true,
        alreadyPaid: false,
        purchaseId: purchase.id,
        tokens: purchase.tokens,
      };
    });

    /*
     * Risposta per evento duplicato.
     */

    if (result.duplicate) {
      return NextResponse.json({
        received: true,
        verified: true,
        duplicate: true,
      });
    }

    /*
     * Evento verificato ma non rilevante
     * per l'accredito dei token.
     */

    if (!result.processed) {
      return NextResponse.json({
        received: true,
        verified: true,
        processed: false,
      });
    }

    /*
     * Acquisto già processato.
     */

    if (result.alreadyPaid) {
      return NextResponse.json({
        received: true,
        verified: true,
        processed: true,
        alreadyPaid: true,
        purchaseId: result.purchaseId,
        tokens: result.tokens,
      });
    }

    /*
     * Accredito completato.
     */

    return NextResponse.json({
      received: true,
      verified: true,
      processed: true,
      purchaseId: result.purchaseId,
      tokens: result.tokens,
    });
  } catch (error) {
    console.error(
      "Paymos webhook error:",
      error
    );

    return NextResponse.json(
      { error: "Errore interno" },
      { status: 500 }
    );
  }
}