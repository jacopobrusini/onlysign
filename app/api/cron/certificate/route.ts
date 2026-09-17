import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";

const PPQCHECK_API_BASE =
  "https://br.api-developer.dev/v1/integration";

type PpqcheckCertificateResponse = {
  code: number;
  message: string;
  data?: {
    id?: string;
    code?: string;
    udid?: string;
    status?: string;
    certificateRevoked?: boolean;
    name?: string;
    warrantyPeriod?: number;
    createdAt?: string;
    expiryDate?: string | null;
    zip?: string;
    filename?: string;
    zipError?: string | null;
    price?: number;
    currency?: string;
  };
  timestamp?: string;
  path?: string;
};

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error(
      "Certificate cron: CRON_SECRET non configurato"
    );

    return false;
  }

  const authorization =
    request.headers.get("authorization");

  return authorization === `Bearer ${cronSecret}`;
}

async function failOrderAndRestoreTokens(
  orderId: number
) {
  await db.transaction(async (tx) => {
    const order =
      await tx.orm.public.CertificateOrder
        .where({
          id: orderId,
        })
        .first();

    if (!order) {
      return;
    }

    if (
      order.status === "SUCCESS" ||
      order.status === "FAILED"
    ) {
      return;
    }

    const user =
      await tx.orm.public.User
        .where({
          id: order.userId,
        })
        .first();

    if (!user) {
      throw new Error(
        `Utente ${order.userId} non trovato`
      );
    }

    await tx.orm.public.User
      .where({
        id: order.userId,
      })
      .update({
        tokenBalance:
          user.tokenBalance + order.tokens,
      });

    await tx.orm.public.CertificateOrder
      .where({
        id: order.id,
      })
      .update({
        status: "FAILED",
      });
  });
}

async function completeSuccessfulOrder(
  orderId: number,
  certificate: NonNullable<
    PpqcheckCertificateResponse["data"]
  >
) {
  await db.transaction(async (tx) => {
    const order =
      await tx.orm.public.CertificateOrder
        .where({
          id: orderId,
        })
        .first();

    if (!order) {
      return;
    }

    if (order.status === "SUCCESS") {
      return;
    }

const amount =
  typeof certificate.price === "number"
    ? certificate.price
    : 0;

await tx.orm.public.PpqcheckTransaction.create({
  type: "CERTIFICATE_COST",
  amount: String(amount),
  certificateOrderId: order.id,
  description:
    `PPQCheck certificate ${certificate.code ?? order.ppqcheckOrderId}`,
});

    await tx.orm.public.TokenTransaction.create({
      userId: order.userId,
      amount: -order.tokens,
      type: "CERTIFICATE",
      orderId: order.id,
    });

    await tx.orm.public.CertificateOrder
      .where({
        id: order.id,
      })
      .update({
        status: "SUCCESS",
      });
  });
}

export async function GET(
  request: NextRequest
) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const apiKey =
      process.env.PPQCHECK_API_KEY;

    if (!apiKey) {
      console.error(
        "Certificate cron: PPQCHECK_API_KEY mancante"
      );

      return NextResponse.json(
        {
          error:
            "PPQCHECK_API_KEY mancante",
        },
        {
          status: 500,
        }
      );
    }

    const processingOrders =
      await db.orm.public.CertificateOrder
        .where({
          status: "PROCESSING",
        })
        .all();

    console.log(
      `Certificate cron: trovati ${processingOrders.length} ordini PROCESSING`
    );

    let completed = 0;
    let stillProcessing = 0;
    let failed = 0;

    for (const order of processingOrders) {
      if (!order.ppqcheckOrderId) {
        console.error(
          `Certificate cron: ordine ${order.id} senza ppqcheckOrderId`
        );

        await failOrderAndRestoreTokens(
          order.id
        );

        failed++;
        continue;
      }

      const ppqcheckUrl =
        `${PPQCHECK_API_BASE}/certificate?id=` +
        encodeURIComponent(
          order.ppqcheckOrderId
        );

      try {
        const response = await fetch(
          ppqcheckUrl,
          {
            method: "GET",
            headers: {
              "X-API-Key": apiKey,
              Accept: "application/json",
            },
            cache: "no-store",
          }
        );

        const rawResponse =
          await response.text();

        console.log(
          `PPQCheck RAW CERTIFICATE RESPONSE [order=${order.id}]:`,
          rawResponse
        );

        let ppqcheckResponse: PpqcheckCertificateResponse;

        try {
          ppqcheckResponse =
            JSON.parse(
              rawResponse
            ) as PpqcheckCertificateResponse;
        } catch (error) {
          console.error(
            `Certificate cron: JSON non valido [order=${order.id}]`,
            error
          );

          stillProcessing++;
          continue;
        }

        if (!response.ok) {
          console.error(
            `Certificate cron: PPQCheck HTTP ${response.status} [order=${order.id}]`,
            ppqcheckResponse
          );

          stillProcessing++;
          continue;
        }

        const certificate =
          ppqcheckResponse.data;

        if (!certificate) {
          console.error(
            `Certificate cron: dati certificato mancanti [order=${order.id}]`
          );

          stillProcessing++;
          continue;
        }

        console.log(
          `Certificate cron: order=${order.id}, ppqStatus=${certificate.status}`
        );

        /*
         * Certificato pronto.
         */
        if (
          certificate.status === "success"
        ) {
          if (
            certificate.certificateRevoked
          ) {
            console.error(
              `Certificate cron: certificato revocato [order=${order.id}]`
            );

            await failOrderAndRestoreTokens(
              order.id
            );

            failed++;
            continue;
          }

          /*
           * Lo stato success deve essere accompagnato
           * dal relativo ZIP.
           */
          if (!certificate.zip) {
            console.error(
              `Certificate cron: status success ma ZIP mancante [order=${order.id}]`,
              {
                zipError:
                  certificate.zipError,
              }
            );

            stillProcessing++;
            continue;
          }

          await completeSuccessfulOrder(
            order.id,
            certificate
          );

          completed++;
          continue;
        }

        /*
         * PPQCheck sta ancora elaborando l'ordine.
         */
        if (
          certificate.status === "processing" ||
          certificate.status === "pending" ||
          certificate.status === "created" ||
          certificate.status === "payment_pending" ||
          certificate.status === "payment_success"
        ) {
          stillProcessing++;
          continue;
        }

        /*
         * Stato non riconosciuto:
         * lasciamo l'ordine PROCESSING.
         */
        console.warn(
          `Certificate cron: stato PPQCheck non riconosciuto [order=${order.id}]: ${certificate.status}`
        );

        stillProcessing++;
      } catch (error) {
        /*
         * Errore temporaneo di rete/API.
         * Non modifichiamo l'ordine.
         */
        console.error(
          `Certificate cron: errore elaborazione ordine ${order.id}`,
          error
        );

        stillProcessing++;
      }
    }

    return NextResponse.json({
      success: true,
      processed:
        processingOrders.length,
      completed,
      stillProcessing,
      failed,
    });
  } catch (error) {
    console.error(
      "Certificate cron fatal error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Errore interno del cron certificati",
      },
      {
        status: 500,
      }
    );
  }
}