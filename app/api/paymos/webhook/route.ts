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

const WEBHOOK_TOLERANCE_SECONDS = 300;

function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
) {
  if (!signatureHeader) {
    return false;
  }

  const parts = signatureHeader.split(",");

  let timestamp: string | undefined;
  let signature: string | undefined;

  for (const part of parts) {
    const [key, value] = part.split("=");

    if (key === "t") {
      timestamp = value;
    }

    if (key === "v1") {
      signature = value;
    }
  }

  if (!timestamp || !signature) {
    return false;
  }

  const timestampNumber = Number(timestamp);

  if (!Number.isFinite(timestampNumber)) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);

  if (
    Math.abs(now - timestampNumber) >
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

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  const receivedBuffer = Buffer.from(
    signature,
    "utf8"
  );

  const expectedBuffer = Buffer.from(
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
  const data = payload.data;

  console.log(
    "PAYMOS INVOICE EVENT:",
    {
      eventType: payload.event_type,
      eventId: payload.event_id,
      status: data?.status,
      isFinal: data?.is_final,
      invoiceId: data?.invoice_id,
      externalOrderId:
        data?.order?.external_id,
      orderAmount:
        data?.order?.amount,
      orderCurrency:
        data?.order?.currency,
      amount:
        data?.amount,
      currency:
        data?.currency,
    }
  );

  if (!data) {
    console.log(
      "Paymos invoice ignored: missing data"
    );

    return {
      processed: false,
      ignored: true,
    };
  }

  const status = data.status;

  const isFinalPayment =
    status === "paid" ||
    status === "paid_over";

  if (
    !isFinalPayment ||
    data.is_final !== true
  ) {
    console.log(
      "Paymos invoice ignored: payment not final",
      {
        status,
        isFinal: data.is_final,
      }
    );

    return {
      processed: false,
      ignored: true,
    };
  }

  const externalOrderId =
    data.order?.external_id ??
    data.external_order_id;

  if (!externalOrderId) {
    console.error(
      "Paymos invoice missing external_order_id",
      {
        invoiceId: data.invoice_id,
      }
    );

    return {
      processed: false,
      ignored: true,
    };
  }

  const purchases =
    await db.orm.public.TokenPurchase
      .where({
        paymosOrderId: externalOrderId,
      })
      .all();

  const purchase = purchases[0];

  if (!purchase) {
    console.error(
      "Paymos invoice purchase not found",
      {
        externalOrderId,
      }
    );

    return {
      processed: false,
      ignored: true,
    };
  }

  const expectedAmount = Number(
    purchase.amount
  );

  const receivedOrderAmount =
    Number(data.order?.amount);

  if (
    !Number.isFinite(expectedAmount) ||
    !Number.isFinite(receivedOrderAmount)
  ) {
    console.error(
      "Paymos invoice amount invalid",
      {
        purchaseId: purchase.id,
        expectedAmount,
        receivedOrderAmount,
      }
    );

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
    console.error(
      "Paymos invoice amount mismatch",
      {
        purchaseId: purchase.id,
        expectedAmount,
        receivedOrderAmount,
      }
    );

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
    currency.toUpperCase() !== "EUR"
  ) {
    console.error(
      "Paymos invoice currency mismatch",
      {
        purchaseId: purchase.id,
        currency,
      }
    );

    return {
      processed: false,
      ignored: true,
    };
  }

  if (
    purchase.status !== "PENDING" &&
    purchase.status !== "PAID"
  ) {
    console.log(
      "Paymos invoice already handled",
      {
        purchaseId: purchase.id,
        status: purchase.status,
      }
    );

    return {
      processed: true,
      alreadyProcessed: true,
    };
  }

  if (purchase.status === "PENDING") {
    await db.orm.public.TokenPurchase
      .where({
        id: purchase.id,
      })
      .update({
        status: "PAID",
        paymentStatus: "PAID",
      });
  }

  const result =
    await processPaidTokenPurchase(
      purchase.id
    );

  console.log(
    "Paymos invoice processed",
    {
      purchaseId: purchase.id,
      externalOrderId,
      invoiceId: data.invoice_id,
      status,
      result,
    }
  );

  return {
    processed: true,
    result,
  };
}

async function handleWithdrawal(
  payload: PaymosWebhookPayload
) {
  const data = payload.data;

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
    console.log(
      "Paymos withdrawal ignored: missing external_order_id"
    );

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
    console.log(
      "Paymos withdrawal ignored: unrelated order",
      {
        externalOrderId,
      }
    );

    return {
      processed: false,
      ignored: true,
    };
  }

  const purchaseId = Number(
    externalOrderId.replace(
      "onlysign_ppq_funding_",
      ""
    )
  );

  if (
    !Number.isInteger(purchaseId) ||
    purchaseId <= 0
  ) {
    console.error(
      "Paymos withdrawal: invalid purchaseId",
      {
        externalOrderId,
        purchaseId,
      }
    );

    return {
      processed: false,
      ignored: true,
    };
  }

  const status = data.status;

  console.log(
    "PAYMOS WITHDRAWAL EVENT:",
    {
      eventType: payload.event_type,
      eventId: payload.event_id,
      withdrawalId:
        data.withdrawal_id,
      status,
      isFinal: data.is_final,
      externalOrderId,
      purchaseId,
      txHash: data.tx_hash,
    }
  );

  /*
   * Keep the Paymos withdrawal status
   * synchronized in our database.
   */
  const fundingTransactions =
    await db.orm.public.PpqcheckTransaction
      .where({
        tokenPurchaseId: purchaseId,
      })
      .all();

  const fundingTransaction =
    fundingTransactions[0];

  if (!fundingTransaction) {
    console.error(
      "Paymos withdrawal: PPQCheck transaction not found",
      {
        purchaseId,
        withdrawalId:
          data.withdrawal_id,
        externalOrderId,
      }
    );

    return {
      processed: false,
      ignored: true,
    };
  }

  if (data.withdrawal_id) {
    await db.orm.public.PpqcheckTransaction
      .where({
        id: fundingTransaction.id,
      })
      .update({
        paymosWithdrawalId:
          data.withdrawal_id,
        paymosWithdrawalStatus:
          status ?? "unknown",
      });
  } else if (status) {
    await db.orm.public.PpqcheckTransaction
      .where({
        id: fundingTransaction.id,
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

    console.error(
      "Paymos PPQCheck funding failed",
      {
        purchaseId,
        withdrawalId:
          data.withdrawal_id,
        status,
      }
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
    /*
     * The Paymos withdrawal is now confirmed.
     * The customer has already paid, and the
     * PPQCheck funding transfer is completed.
     *
     * Move the purchase into PAID_FUNDING
     * before trying to finalize it.
     */
    await db.orm.public.PpqcheckTransaction
      .where({
        id: fundingTransaction.id,
      })
      .update({
        fundingStatus: "PENDING",
        paymosWithdrawalStatus:
          "completed",
      });

    await db.orm.public.TokenPurchase
      .where({
        id: purchaseId,
      })
      .update({
        paymentStatus:
          "PAID_FUNDING",
      });

    console.log(
      "Paymos PPQCheck funding marked as PAID_FUNDING",
      {
        purchaseId,
        withdrawalId:
          data.withdrawal_id,
      }
    );

    const result =
      await finalizeTokenPurchase(
        purchaseId
      );

    console.log(
      "Paymos PPQCheck funding completed",
      {
        purchaseId,
        withdrawalId:
          data.withdrawal_id,
        result,
      }
    );

    return {
      processed: true,
      result,
    };
  }

  console.log(
    "Paymos PPQCheck withdrawal pending",
    {
      purchaseId,
      withdrawalId:
        data.withdrawal_id,
      status,
    }
  );

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
      console.error(
        "Paymos webhook: invalid signature"
      );

      return NextResponse.json(
        {
          error: "Invalid signature",
        },
        {
          status: 401,
        }
      );
    }

    let payload: PaymosWebhookPayload;

    try {
      payload =
        JSON.parse(rawBody) as PaymosWebhookPayload;
    } catch {
      return NextResponse.json(
        {
          error: "Invalid JSON",
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

    if (!eventId || !eventType) {
      console.error(
        "Paymos webhook: missing event metadata",
        {
          eventId,
          eventType,
        }
      );

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
      console.log(
        "Paymos webhook already processed",
        {
          eventId,
          eventType,
        }
      );

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
          fundingFailed?: boolean;
          result?: unknown;
        }
      | undefined;

    if (
      eventType === "invoice.paid" ||
      eventType === "invoice.paid_over"
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
      console.log(
        "Paymos webhook ignored: unsupported event",
        {
          eventId,
          eventType,
        }
      );

      result = {
        processed: false,
        ignored: true,
      };
    }

    if (
      result.processed ||
      result.ignored
    ) {
      await saveWebhookEvent(
        eventId,
        eventType
      );
    }

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