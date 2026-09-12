import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/prisma/db";

const PPQCHECK_BUDGET_PER_TOKEN = 1.4;

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

  return crypto.timingSafeEqual(
    aBuffer,
    bBuffer
  );
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
      .createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

  return signatures.some((signature) =>
    safeEqual(
      signature,
      expectedSignature
    )
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    const webhookSecret =
      process.env.PAYMOS_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error(
        "Paymos webhook: PAYMOS_WEBHOOK_SECRET missing"
      );

      return NextResponse.json(
        {
          error:
            "Webhook non configurato",
        },
        { status: 500 }
      );
    }

    const rawBody =
      await request.text();

    const signatureHeader =
      request.headers.get(
        "x-webhook-signature"
      );

    if (!signatureHeader) {
      return NextResponse.json(
        {
          error: "Firma mancante",
        },
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
        {
          error: "Firma non valida",
        },
        { status: 401 }
      );
    }

    let payload: PaymosWebhookPayload;

    try {
      payload =
        JSON.parse(rawBody) as PaymosWebhookPayload;
    } catch {
      return NextResponse.json(
        {
          error: "Payload non valido",
        },
        { status: 400 }
      );
    }

    const eventId =
      payload.event_id ??
      request.headers.get(
        "x-webhook-id"
      );

    const eventType =
      payload.event_type;

    if (!eventId || !eventType) {
      return NextResponse.json(
        {
          error: "Evento non valido",
        },
        { status: 400 }
      );
    }

    const result =
      await db.transaction(async (tx) => {
        /*
         * ─────────────────────────────────────────
         * DEDUPLICAZIONE
         * ─────────────────────────────────────────
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
         * Registriamo l'evento.
         */

        await tx.orm.public.PaymosWebhookEvent.create({
          eventId,
          eventType,
        });

        /*
         * Gestiamo solamente gli eventi
         * di pagamento finale.
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

        const data =
          payload.data;

        if (!data) {
          throw new Error(
            "PAYMOS_DATA_MISSING"
          );
        }

        /*
         * Il pagamento deve essere:
         *
         * status = paid
         * is_final = true
         */

        if (
          data.status !== "paid" ||
          data.is_final !== true
        ) {
          return {
            duplicate: false,
            processed: false,
          };
        }

        /*
         * external_id identifica il TokenPurchase.
         */

        const externalOrderId =
          data.order?.external_id;

        if (!externalOrderId) {
          throw new Error(
            "PAYMOS_EXTERNAL_ID_MISSING"
          );
        }

        /*
         * Recuperiamo l'acquisto.
         */

        const purchases =
          await tx.orm.public.TokenPurchase
            .where({
              paymosOrderId:
                externalOrderId,
            })
            .all();

        const purchase =
          purchases[0];

        if (!purchase) {
          throw new Error(
            "TOKEN_PURCHASE_NOT_FOUND"
          );
        }

        /*
         * Verifica importo EUR.
         */

        const orderAmount =
          Number(
            data.order?.amount
          );

        const purchaseAmount =
          Number(
            purchase.amount
          );

        const orderCurrency =
          data.order?.currency;

        if (
          !Number.isFinite(
            orderAmount
          ) ||
          !Number.isFinite(
            purchaseAmount
          ) ||
          orderCurrency !== "EUR" ||
          Math.abs(
            orderAmount -
              purchaseAmount
          ) > 0.01
        ) {
          throw new Error(
            "PAYMOS_AMOUNT_MISMATCH"
          );
        }

        /*
         * ─────────────────────────────────────────
         * CLAIM DELL'ACQUISTO
         * ─────────────────────────────────────────
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
          return {
            duplicate: false,
            processed: true,
            alreadyPaid: true,
            purchaseId:
              purchase.id,
            tokens:
              purchase.tokens,
          };
        }

        /*
         * ─────────────────────────────────────────
         * UTENTE
         * ─────────────────────────────────────────
         */

        const user =
          await tx.orm.public.User
            .where({
              id: purchase.userId,
            })
            .first();

        if (!user) {
          throw new Error(
            "USER_NOT_FOUND"
          );
        }

        /*
         * ─────────────────────────────────────────
         * SYNC CREDIT
         * ─────────────────────────────────────────
         */

        const syncCredit =
          await tx.orm.public.SyncCredit
            .where({
              id: 1,
            })
            .first();

        if (!syncCredit) {
          throw new Error(
            "SYNC_CREDIT_NOT_INITIALIZED"
          );
        }

        /*
         * Budget teorico del pacchetto.
         *
         * Esempio:
         *
         * 1 token  = $1.40
         * 4 token  = $5.60
         * 16 token = $22.40
         */

        const packageFunding =
          purchase.tokens *
          PPQCHECK_BUDGET_PER_TOKEN;

        const currentCoverage =
          Number(
            syncCredit.ppqCoverage
          );

        const currentAmount =
          Number(
            syncCredit.ppqAmount
          );

        if (
          !Number.isFinite(
            currentCoverage
          ) ||
          !Number.isFinite(
            currentAmount
          )
        ) {
          throw new Error(
            "INVALID_SYNC_CREDIT"
          );
        }

        /*
         * Se la coverage disponibile è già
         * sufficiente, non serve aggiungere
         * altro credito.
         */

        const additionalCredit =
          Math.max(
            0,
            packageFunding -
              currentCoverage
          );

        /*
         * Nuovi valori contabili.
         */

        const newPpqAmount =
          currentAmount +
          additionalCredit;

        const newPpqCoverage =
          currentCoverage +
          additionalCredit;

        /*
         * Aggiornamento atomico di SyncCredit.
         */

        const syncCreditUpdate =
          tx.sql.public.syncCredit
            .update((f, fns) => ({
              ppqAmount:
                fns.raw`${newPpqAmount.toFixed(2)}`
                  .returns("pg/numeric@1"),

              ppqCoverage:
                fns.raw`${newPpqCoverage.toFixed(2)}`
                  .returns("pg/numeric@1"),
            }))
            .where((f, fns) =>
              fns.eq(
                f.id,
                syncCredit.id
              )
            )
            .build();

        await tx.execute(
          syncCreditUpdate
        );

        /*
         * ─────────────────────────────────────────
         * TOKEN BALANCE
         * ─────────────────────────────────────────
         */

        const incrementPlan =
          tx.sql.public.user
            .update((f, fns) => ({
              tokenBalance:
                fns.raw`${f.tokenBalance} + ${purchase.tokens}`
                  .returns("pg/int4@1"),
            }))
            .where((f, fns) =>
              fns.eq(
                f.id,
                purchase.userId
              )
            )
            .build();

        await tx.execute(
          incrementPlan
        );

        /*
         * ─────────────────────────────────────────
         * TOKEN TRANSACTION
         * ─────────────────────────────────────────
         */

        await tx.orm.public.TokenTransaction.create({
          userId:
            purchase.userId,

          amount:
            purchase.tokens,

          type:
            "PURCHASE",

          purchaseId:
            purchase.id,
        });

        console.log(
          "Paymos webhook: acquisto processato",
          {
            eventId,
            purchaseId:
              purchase.id,
            userId:
              purchase.userId,
            tokens:
              purchase.tokens,
            packageFunding,
            additionalCredit,
            ppqAmount:
              newPpqAmount,
            ppqCoverage:
              newPpqCoverage,
          }
        );

        return {
          duplicate: false,
          processed: true,
          alreadyPaid: false,

          purchaseId:
            purchase.id,

          tokens:
            purchase.tokens,

          packageFunding,

          additionalCredit,
        };
      });

    /*
     * ─────────────────────────────────────────────
     * RISPOSTA
     * ─────────────────────────────────────────────
     */

    if (result.duplicate) {
      return NextResponse.json({
        received: true,
        verified: true,
        duplicate: true,
      });
    }

    if (!result.processed) {
      return NextResponse.json({
        received: true,
        verified: true,
        processed: false,
      });
    }

    if (result.alreadyPaid) {
      return NextResponse.json({
        received: true,
        verified: true,
        processed: true,
        alreadyPaid: true,
        purchaseId:
          result.purchaseId,
        tokens:
          result.tokens,
      });
    }

    return NextResponse.json({
      received: true,
      verified: true,
      processed: true,
      purchaseId:
        result.purchaseId,
      tokens:
        result.tokens,
      additionalCredit:
        result.additionalCredit,
    });
  } catch (error) {
    console.error(
      "Paymos webhook error:",
      error
    );

    if (
      error instanceof Error &&
      error.message ===
        "PAYMOS_AMOUNT_MISMATCH"
    ) {
      return NextResponse.json(
        {
          error:
            "Importo o valuta non corrispondenti",
        },
        { status: 400 }
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "TOKEN_PURCHASE_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          error:
            "Acquisto non trovato",
        },
        { status: 404 }
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "SYNC_CREDIT_NOT_INITIALIZED"
    ) {
      return NextResponse.json(
        {
          error:
            "Sistema di credito PPQCheck non inizializzato",
        },
        { status: 500 }
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "INVALID_SYNC_CREDIT"
    ) {
      return NextResponse.json(
        {
          error:
            "Credito PPQCheck non valido",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Errore interno",
      },
      { status: 500 }
    );
  }
}