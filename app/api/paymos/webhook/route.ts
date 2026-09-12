import {
  NextRequest,
  NextResponse,
} from "next/server";

import crypto from "crypto";

import { db } from "@/prisma/db";

import {
  processPaidTokenPurchase,
  finalizeTokenPurchase,
  markFundingFailed,
} from "@/lib/sync-credit";

const WEBHOOK_TOLERANCE_SECONDS =
  300;

type PaymosWebhookPayload = {
  event_id?: string;

  event_type?: string;

  version?: number;

  occurred_at?: number;

  data?: {
    invoice_id?: string;

    withdrawal_id?: string;

    status?: string;

    is_final?: boolean;

    is_test?: boolean;

    external_order_id?: string;

    order?: {
      external_id?: string;

      client_id?: string;

      amount?: string;

      currency?: string;
    };

    amount?: string;

    currency?: string;

    network?: string;

    destination_address?: string;

    tx_hash?: string;
  };
};

function safeEqual(
  a: string,
  b: string
) {
  const aBuffer =
    Buffer.from(
      a,
      "utf8"
    );

  const bBuffer =
    Buffer.from(
      b,
      "utf8"
    );

  if (
    aBuffer.length !==
    bBuffer.length
  ) {
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
  const parts =
    signatureHeader.split(
      ","
    );

  let timestamp:
    | string
    | null = null;

  const signatures:
    string[] = [];

  for (
    const part of parts
  ) {
    const [
      key,
      value,
    ] =
      part.split(
        "=",
        2
      );

    if (
      key === "t" &&
      value
    ) {
      timestamp =
        value;
    }

    if (
      key === "v1" &&
      value
    ) {
      signatures.push(
        value
      );
    }
  }

  if (
    !timestamp ||
    signatures.length === 0
  ) {
    return false;
  }

  const timestampNumber =
    Number(
      timestamp
    );

  if (
    !Number.isInteger(
      timestampNumber
    )
  ) {
    return false;
  }

  const now =
    Math.floor(
      Date.now() / 1000
    );

  if (
    Math.abs(
      now -
        timestampNumber
    ) >
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
      .update(
        signedPayload
      )
      .digest("hex");

  return signatures.some(
    (signature) =>
      safeEqual(
        signature,
        expectedSignature
      )
  );
}

async function saveWebhookEvent(
  eventId: string,
  eventType: string
) {
  const existing =
    await db.orm.public.PaymosWebhookEvent
      .where({
        eventId,
      })
      .first();

  if (existing) {
    return false;
  }

  await db.orm.public.PaymosWebhookEvent.create({
    eventId,

    eventType,
  });

  return true;
}

async function handleInvoicePaid(
  payload: PaymosWebhookPayload
) {
  const data =
    payload.data;

  if (!data) {
    throw new Error(
      "PAYMOS_DATA_MISSING"
    );
  }

  if (
    data.status !==
      "paid" ||
    data.is_final !==
      true
  ) {
    return {
      processed: false,
    };
  }

  const externalOrderId =
    data.order
      ?.external_id;

  if (
    !externalOrderId
  ) {
    throw new Error(
      "PAYMOS_EXTERNAL_ID_MISSING"
    );
  }

  const purchases =
    await db.orm.public.TokenPurchase
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
    orderCurrency !==
      "EUR" ||
    Math.abs(
      orderAmount -
        purchaseAmount
    ) >
      0.01
  ) {
    throw new Error(
      "PAYMOS_AMOUNT_MISMATCH"
    );
  }

  /*
   * Claim dell'acquisto.
   *
   * Se è già PAID, non è un problema:
   * potrebbe essere un retry necessario
   * per completare un funding precedente.
   */
  if (
    purchase.status ===
    "PENDING"
  ) {
    await db.orm.public.TokenPurchase
      .where({
        id:
          purchase.id,

        status:
          "PENDING",
      })
      .update({
        status:
          "PAID",

        paymentStatus:
          "PAID",
      });
  }

  const result =
    await processPaidTokenPurchase(
      purchase.id
    );

  console.log(
    "Paymos invoice processed",
    {
      purchaseId:
        purchase.id,

      result,
    }
  );

  return {
    processed: true,

    purchaseId:
      purchase.id,

    result,
  };
}

async function handleWithdrawal(
  payload: PaymosWebhookPayload
) {
  const data =
    payload.data;

  if (!data) {
    throw new Error(
      "PAYMOS_DATA_MISSING"
    );
  }

  const externalOrderId =
    data.external_order_id;

  if (
    !externalOrderId
  ) {
    throw new Error(
      "PAYMOS_WITHDRAWAL_EXTERNAL_ID_MISSING"
    );
  }

  const prefix =
    "onlysign_ppq_funding_";

  if (
    !externalOrderId.startsWith(
      prefix
    )
  ) {
    /*
     * Withdrawal di altro tipo:
     * non appartiene al sistema SyncCredit.
     */
    return {
      processed: false,
      ignored: true,
    };
  }

  const purchaseId =
    Number(
      externalOrderId.slice(
        prefix.length
      )
    );

  if (
    !Number.isInteger(
      purchaseId
    ) ||
    purchaseId <= 0
  ) {
    throw new Error(
      "INVALID_FUNDING_PURCHASE_ID"
    );
  }

  if (
    data.status ===
      "failed" ||
    data.status ===
      "cancelled"
  ) {
    await markFundingFailed(
      purchaseId
    );

    return {
      processed: true,

      fundingFailed: true,

      purchaseId,

      withdrawalStatus:
        data.status,
    };
  }

  if (
    data.status !==
      "completed" ||
    data.is_final !==
      true
  ) {
    /*
     * created / processing / signed:
     * non accreditiamo ancora nulla.
     */
    return {
      processed: false,

      pending: true,

      purchaseId,

      withdrawalStatus:
        data.status,
    };
  }

  /*
   * Il payout è completato.
   *
   * finalizeTokenPurchase() farà una
   * verifica reale del saldo PPQCheck
   * prima di accreditare i token.
   */
  const result =
    await finalizeTokenPurchase(
      purchaseId
    );

  console.log(
    "Paymos funding completed",
    {
      purchaseId,

      withdrawalId:
        data.withdrawal_id,

      result,
    }
  );

  return {
    processed: true,

    purchaseId,

    result,
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    const webhookSecret =
      process.env
        .PAYMOS_WEBHOOK_SECRET;

    if (
      !webhookSecret
    ) {
      console.error(
        "Paymos webhook: PAYMOS_WEBHOOK_SECRET missing"
      );

      return NextResponse.json(
        {
          error:
            "Webhook non configurato",
        },
        {
          status: 500,
        }
      );
    }

    const rawBody =
      await request.text();

    const signatureHeader =
      request.headers.get(
        "x-webhook-signature"
      );

    if (
      !signatureHeader
    ) {
      return NextResponse.json(
        {
          error:
            "Firma mancante",
        },
        {
          status: 401,
        }
      );
    }

    const validSignature =
      verifyWebhookSignature(
        signatureHeader,

        rawBody,

        webhookSecret
      );

    if (
      !validSignature
    ) {
      return NextResponse.json(
        {
          error:
            "Firma non valida",
        },
        {
          status: 401,
        }
      );
    }

    let payload:
      PaymosWebhookPayload;

    try {
      payload =
        JSON.parse(
          rawBody
        ) as PaymosWebhookPayload;
    } catch {
      return NextResponse.json(
        {
          error:
            "Payload non valido",
        },
        {
          status: 400,
        }
      );
    }

    const eventId =
      payload.event_id ??
      request.headers.get(
        "x-webhook-id"
      );

    const eventType =
      payload.event_type;

    if (
      !eventId ||
      !eventType
    ) {
      return NextResponse.json(
        {
          error:
            "Evento non valido",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Dedupe iniziale.
     *
     * NON registriamo ancora l'evento.
     * Lo registriamo solamente dopo che
     * il processing è andato a buon fine.
     */
    const existingEvent =
      await db.orm.public.PaymosWebhookEvent
        .where({
          eventId,
        })
        .first();

    if (existingEvent) {
      return NextResponse.json({
        received: true,

        verified: true,

        duplicate: true,
      });
    }

    let result:
      | {
          processed: boolean;

          [key: string]:
            unknown;
        }
      | undefined;

    if (
      eventType ===
        "invoice.paid" ||
      eventType ===
        "invoice.paid_over"
    ) {
      result =
        await handleInvoicePaid(
          payload
        );
    } else if (
      eventType ===
        "withdrawal.completed" ||
      eventType ===
        "withdrawal.failed" ||
      eventType ===
        "withdrawal.cancelled" ||
      eventType ===
        "withdrawal.created" ||
      eventType ===
        "withdrawal.processing"
    ) {
      result =
        await handleWithdrawal(
          payload
        );
    } else {
      /*
       * Evento Paymos non rilevante
       * per questa fase.
       */
      result = {
        processed: false,

        ignored: true,
      };
    }

    /*
     * Registriamo l'evento solamente ora.
     *
     * Se una delle operazioni sopra fallisce,
     * viene restituito 500 e Paymos può
     * ritentare.
     */
    await saveWebhookEvent(
      eventId,

      eventType
    );

    console.log(
      "=== PAYMOS WEBHOOK PROCESSED ===",
      {
        eventId,

        eventType,

        result,
      }
    );

    return NextResponse.json({
      received: true,

      verified: true,

      duplicate: false,

      ...result,
    });
  } catch (error) {
    console.error(
      "Paymos webhook error:",
      error
    );

    if (
      error instanceof Error
    ) {
      switch (
        error.message
      ) {
        case "PAYMOS_AMOUNT_MISMATCH":
          return NextResponse.json(
            {
              error:
                "Importo o valuta non corrispondenti",
            },
            {
              status: 400,
            }
          );

        case "TOKEN_PURCHASE_NOT_FOUND":
          return NextResponse.json(
            {
              error:
                "Acquisto non trovato",
            },
            {
              status: 404,
            }
          );

        case "PPQCHECK_BELOW_COVERAGE":
          return NextResponse.json(
            {
              error:
                "PPQCheck sotto coverage",
            },
            {
              status: 500,
            }
          );

        case "PPQCHECK_FUNDING_NOT_VISIBLE":
          return NextResponse.json(
            {
              error:
                "Funding PPQCheck non ancora visibile",
            },
            {
              status: 500,
            }
          );
      }
    }

    return NextResponse.json(
      {
        error:
          "Errore interno",
      },
      {
        status: 500,
      }
    );
  }
}