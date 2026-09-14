import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/prisma/db";
import {
  finalizeTokenPurchase,
  markFundingFailed,
  processPaidTokenPurchase,
} from "@/lib/sync-credit";

type PaymosWebhookPayload = {
  event_id?: string;

  event_type?: string;

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

const WEBHOOK_TOLERANCE_SECONDS =
  300;

function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
) {
  if (!signatureHeader) {
    return false;
  }

  const parts =
    signatureHeader.split(",");

  let timestamp:
    | string
    | undefined;

  let signature:
    | string
    | undefined;

  for (
    const part of parts
  ) {
    const [key, value] =
      part.split("=");

    if (key === "t") {
      timestamp = value;
    }

    if (key === "v1") {
      signature = value;
    }
  }

  if (
    !timestamp ||
    !signature
  ) {
    return false;
  }

  const timestampNumber =
    Number(timestamp);

  if (
    !Number.isFinite(
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

  const secret =
    process.env.PAYMOS_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error(
      "PAYMOS_WEBHOOK_SECRET_MISSING"
    );
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

  const receivedBuffer =
    Buffer.from(
      signature,
      "utf8"
    );

  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "utf8"
    );

  if (
    receivedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    receivedBuffer,
    expectedBuffer
  );
}

async function webhookEventExists(
  eventId: string
) {
  const events =
    await db.orm.public.PaymosWebhookEvent
      .where({
        eventId,
      })
      .all();

  return events.length > 0;
}

async function saveWebhookEvent(
  eventId: string,
  eventType: string
) {
  await db.orm.public.PaymosWebhookEvent.create({
    eventId,
    eventType,
  });
}

async function handleInvoicePaid(
  payload: PaymosWebhookPayload
) {
  const data =
    payload.data;

  if (!data) {
    return {
      processed: false,
      ignored: true,
    };
  }

  const status =
    data.status;

  const isFinalPayment =
    status === "paid" ||
    status === "paid_over";

  if (
    !isFinalPayment ||
    data.is_final !== true
  ) {
    return {
      processed: false,
      ignored: true,
    };
  }

  const externalOrderId =
    data.order?.external_id ??
    data.external_order_id;

  if (!externalOrderId) {
    return {
      processed: false,
      ignored: true,
    };
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

  /*
   * Il purchase potrebbe essere già stato
   * completato e cancellato.
   *
   * In questo caso non c'è più nulla da fare.
   */
  if (!purchase) {
    return {
      processed: true,
      alreadyCompleted: true,
    };
  }

  const expectedAmount =
    Number(
      purchase.amount
    );

  const receivedOrderAmount =
    Number(
      data.order?.amount
    );

  if (
    !Number.isFinite(
      expectedAmount
    ) ||
    !Number.isFinite(
      receivedOrderAmount
    )
  ) {
    return {
      processed: false,
      ignored: true,
    };
  }

  if (
    Math.abs(
      receivedOrderAmount -
        expectedAmount
    ) > 0.01
  ) {
    return {
      processed: false,
      ignored: true,
    };
  }

  const currency =
    data.order?.currency ??
    data.currency;

  if (
    currency &&
    currency.toUpperCase() !==
      "EUR"
  ) {
    return {
      processed: false,
      ignored: true,
    };
  }

  if (
    purchase.status !==
      "PENDING" &&
    purchase.status !==
      "PAID"
  ) {
    return {
      processed: true,
      alreadyProcessed: true,
    };
  }

  if (
    purchase.status ===
    "PENDING"
  ) {
    await db.orm.public.TokenPurchase
      .where({
        id:
          purchase.id,
      })
      .update({
        status:
          "PAID",
      });
  }

  const result =
    await processPaidTokenPurchase(
      purchase.id
    );

  return {
    processed: true,
    result,
  };
}

async function handleWithdrawal(
  payload: PaymosWebhookPayload
) {
  const data =
    payload.data;

  if (!data) {
    return {
      processed: false,
      ignored: true,
    };
  }

  const externalOrderId =
    data.order?.external_id ??
    data.external_order_id;

  if (!externalOrderId) {
    return {
      processed: false,
      ignored: true,
    };
  }

  if (
    !externalOrderId.startsWith(
      "onlysign_ppq_funding_"
    )
  ) {
    return {
      processed: false,
      ignored: true,
    };
  }

  const purchaseId =
    Number(
      externalOrderId.replace(
        "onlysign_ppq_funding_",
        ""
      )
    );

  if (
    !Number.isInteger(
      purchaseId
    ) ||
    purchaseId <= 0
  ) {
    return {
      processed: false,
      ignored: true,
    };
  }

  const status =
    data.status;

  const fundingTransactions =
    await db.orm.public.PpqcheckTransaction
      .where({
        tokenPurchaseId:
          purchaseId,
      })
      .all();

  const fundingTransaction =
    fundingTransactions[0];

  /*
   * Il purchase può essere già stato
   * finalizzato e la transazione tecnica
   * cancellata.
   */
  if (!fundingTransaction) {
    return {
      processed: true,
      alreadyCompleted: true,
    };
  }

  if (
    data.withdrawal_id
  ) {
    await db.orm.public.PpqcheckTransaction
      .where({
        id:
          fundingTransaction.id,
      })
      .update({
        paymosWithdrawalId:
          data.withdrawal_id,

        paymosWithdrawalStatus:
          status ??
          "unknown",
      });
  } else if (status) {
    await db.orm.public.PpqcheckTransaction
      .where({
        id:
          fundingTransaction.id,
      })
      .update({
        paymosWithdrawalStatus:
          status,
      });
  }

  if (
    status === "failed" ||
    status === "cancelled"
  ) {
    await markFundingFailed(
      purchaseId
    );

    return {
      processed: true,
      fundingFailed: true,
    };
  }

  if (
    status === "completed" &&
    data.is_final === true
  ) {
    await db.orm.public.TokenPurchase
      .where({
        id:
          purchaseId,
      })
      .update({
        status:
          "PAID_FUNDING",
      });

    await db.orm.public.PpqcheckTransaction
      .where({
        id:
          fundingTransaction.id,
      })
      .update({
        fundingStatus:
          "PENDING",

        paymosWithdrawalStatus:
          "completed",
      });

    const result =
      await finalizeTokenPurchase(
        purchaseId
      );

    return {
      processed: true,
      result,
    };
  }

  return {
    processed: false,
    pending: true,
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    const rawBody =
      await request.text();

    const signature =
      request.headers.get(
        "x-webhook-signature"
      );

    const isValid =
      verifyWebhookSignature(
        rawBody,
        signature
      );

    if (!isValid) {
      return NextResponse.json(
        {
          error:
            "Invalid signature",
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
            "Invalid JSON",
        },
        {
          status: 400,
        }
      );
    }

    const eventId =
      payload.event_id;

    const eventType =
      payload.event_type;

    if (
      !eventId ||
      !eventType
    ) {
      return NextResponse.json(
        {
          error:
            "Missing event metadata",
        },
        {
          status: 400,
        }
      );
    }

    const alreadyProcessed =
      await webhookEventExists(
        eventId
      );

    if (alreadyProcessed) {
      return NextResponse.json({
        received: true,

        duplicate: true,
      });
    }

    let result:
      | {
          processed: boolean;

          ignored?: boolean;

          pending?: boolean;

          alreadyProcessed?: boolean;

          alreadyCompleted?: boolean;

          fundingFailed?: boolean;

          result?: unknown;
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
      result = {
        processed: false,
        ignored: true,
      };
    }

    /*
     * Gli eventi ignorati o completati
     * vengono memorizzati per impedire
     * elaborazioni duplicate.
     */
    if (
      result.processed ||
      result.ignored
    ) {
      await saveWebhookEvent(
        eventId,
        eventType
      );
    }

    return NextResponse.json({
      received: true,

      ...result,
    });
  } catch (error) {
    console.error(
      "Paymos webhook error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Webhook processing failed",
      },
      {
        status: 500,
      }
    );
  }
}