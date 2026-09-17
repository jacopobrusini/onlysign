import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getSession } from "@/lib/session";

const PPQCHECK_API_BASE =
  "https://br.api-developer.dev/v1/integration";

type PpqcheckCreateResponse = {
  id?: string;
  code?: string;
  status?: string;
  price?: number | string;
  currency?: string;
  requestedCurrency?: string;
  fellBack?: boolean;
};

type PpqcheckCertificateResponse = {
  id?: string;
  code?: string;
  status?: string;
  price?: number | string;
  currency?: string;
  requestedCurrency?: string;
  fellBack?: boolean;
  zip?: string | null;
  filename?: string | null;
};

const POLL_DELAYS = [
  0,
  5000,
  10000,
  15000,
  20000,
  30000,
];

function getStatus(status: string | undefined) {
  return status?.toLowerCase() ?? "";
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Non autenticato" },
        { status: 401 }
      );
    }

    let body: {
      deviceId?: unknown;
      certificateTypeId?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Richiesta non valida" },
        { status: 400 }
      );
    }

    const deviceId = Number(body.deviceId);
    const certificateTypeId = Number(body.certificateTypeId);

    if (
      !Number.isInteger(deviceId) ||
      deviceId <= 0 ||
      !Number.isInteger(certificateTypeId) ||
      certificateTypeId <= 0
    ) {
      return NextResponse.json(
        { error: "Dati certificato non validi" },
        { status: 400 }
      );
    }

    /*
     * Il dispositivo e il tipo di certificato vengono
     * verificati direttamente nel database.
     *
     * Il frontend NON decide:
     * - quanti token costa
     * - quale certificateId PPQCheck usare
     */

    const [device, certificateType] = await Promise.all([
      db.orm.public.Device
        .where({
          id: deviceId,
          userId: session.user.id,
        })
        .first(),

      db.orm.public.CertificateType
        .where({
          id: certificateTypeId,
          active: true,
        })
        .first(),
    ]);

    if (!device) {
      return NextResponse.json(
        { error: "Dispositivo non trovato" },
        { status: 404 }
      );
    }

    if (!certificateType) {
      return NextResponse.json(
        { error: "Certificato non disponibile" },
        { status: 404 }
      );
    }

    /*
     * Tutti i dati commerciali/tecnici del certificato
     * arrivano dal DB.
     */

    const requiredTokens = certificateType.tokens;
    const ppqcheckCertificateId =
      certificateType.ppqcheckId;

    /*
     * ─────────────────────────────────────────────
     * RISERVA TOKEN + CREA ORDINE
     * ─────────────────────────────────────────────
     */

    const reservation = await db.transaction(async (tx) => {
      const user =
        await tx.orm.public.User
          .where({
            id: session.user.id,
          })
          .first();

      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }

      if (user.tokenBalance < requiredTokens) {
        throw new Error("INSUFFICIENT_TOKENS");
      }

      /*
       * Scala i token direttamente dal database.
       */

      const tokenUpdate =
        tx.sql.public.user
          .update((f, fns) => ({
            tokenBalance:
              fns.raw`${f.tokenBalance} - ${requiredTokens}`
                .returns("pg/int4@1"),
          }))
          .where((f, fns) =>
            fns.and(
              fns.eq(f.id, session.user.id),
              fns.gte(
                f.tokenBalance,
                requiredTokens
              )
            )
          )
          .build();

      await tx.execute(tokenUpdate);

      /*
       * Verifica che la prenotazione sia realmente
       * avvenuta.
       */

      const updatedUser =
        await tx.orm.public.User
          .where({
            id: session.user.id,
          })
          .first();

      if (!updatedUser) {
        throw new Error("USER_NOT_FOUND");
      }

      if (
        updatedUser.tokenBalance !==
        user.tokenBalance - requiredTokens
      ) {
        throw new Error("TOKEN_RESERVATION_FAILED");
      }

      /*
       * Crea l'ordine locale.
       */

      const order =
        await tx.orm.public.CertificateOrder.create({
          userId: session.user.id,
          deviceId: device.id,
          certificateTypeId: certificateType.id,
          tokens: requiredTokens,
          status: "PROCESSING",
        });

      return {
        orderId: order.id,
        deviceUdid: device.udid,
        ppqcheckCertificateId,
        requiredTokens,
      };
    });

    /*
     * ─────────────────────────────────────────────
     * PPQCHECK
     * ─────────────────────────────────────────────
     */

    const apiKey =
      process.env.PPQCHECK_API_KEY;

    if (!apiKey) {
      console.error(
        "PPQCheck: API key non configurata"
      );

      await failOrderAndRestoreTokens(
        reservation.orderId,
        reservation.requiredTokens,
        session.user.id
      );

      return NextResponse.json(
        {
          error:
            "Configurazione PPQCheck non disponibile",
        },
        { status: 500 }
      );
    }

    /*
     * POST /certificate
     */

    const createResponse = await fetch(
      `${PPQCHECK_API_BASE}/certificate`,
      {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          udid: reservation.deviceUdid,
          certificateId:
            reservation.ppqcheckCertificateId,
          deviceType: "iphone",
        }),
      }
    );

    const createRaw =
      await createResponse.text();

    /*
     * LOG RAW COMPLETO DELLA RISPOSTA PPQCHECK.
     *
     * Non contiene la API key perché viene loggata
     * solamente la risposta HTTP.
     */

    console.log(
      "PPQCheck RAW CREATE RESPONSE:",
      createRaw
    );

    let createData: PpqcheckCreateResponse = {};

    try {
      createData =
        JSON.parse(createRaw) as PpqcheckCreateResponse;
    } catch {
      console.error(
        "PPQCheck: risposta CREATE non JSON"
      );
    }

    console.log(
      "PPQCheck CREATE RESPONSE:",
      {
        statusCode: createResponse.status,
        ok: createResponse.ok,
        data: createData,
      }
    );

    if (!createResponse.ok) {
      console.error(
        "PPQCheck create certificate failed:",
        createResponse.status,
        createRaw
      );

      await failOrderAndRestoreTokens(
        reservation.orderId,
        reservation.requiredTokens,
        session.user.id
      );

      return NextResponse.json(
        {
          error:
            "Impossibile creare il certificato PPQCheck",
          ppqcheckStatus:
            createResponse.status,
        },
        { status: 502 }
      );
    }

    const ppqcheckOrderId =
      createData.id;

    if (!ppqcheckOrderId) {
      console.error(
        "PPQCheck: ID ordine mancante",
        createData
      );

      await failOrderAndRestoreTokens(
        reservation.orderId,
        reservation.requiredTokens,
        session.user.id
      );

      return NextResponse.json(
        {
          error:
            "Risposta PPQCheck non valida",
        },
        { status: 502 }
      );
    }

    /*
     * Salva il riferimento PPQCheck nel nostro ordine.
     */

    await db.orm.public.CertificateOrder
      .where({
        id: reservation.orderId,
      })
      .update({
        ppqcheckOrderId,
      });

    /*
     * ─────────────────────────────────────────────
     * POLLING PPQCHECK
     * ─────────────────────────────────────────────
     */

    for (const delay of POLL_DELAYS) {
      if (delay > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, delay)
        );
      }

      const certificateResponse =
        await fetch(
          `${PPQCHECK_API_BASE}/certificate?id=${encodeURIComponent(
            ppqcheckOrderId
          )}`,
          {
            method: "GET",
            headers: {
              "X-API-Key": apiKey,
            },
          }
        );

      const certificateRaw =
        await certificateResponse.text();

      /*
       * LOG RAW DI OGNI RISPOSTA DEL POLLING.
       */

      console.log(
        "PPQCheck RAW CERTIFICATE RESPONSE:",
        certificateRaw
      );

      let certificateData:
        PpqcheckCertificateResponse = {};

      try {
        certificateData =
          JSON.parse(
            certificateRaw
          ) as PpqcheckCertificateResponse;
      } catch {
        console.error(
          "PPQCheck: risposta GET certificate non JSON"
        );
      }

      console.log(
        "PPQCheck CERTIFICATE RESPONSE:",
        {
          statusCode:
            certificateResponse.status,
          ok: certificateResponse.ok,
          data: certificateData,
        }
      );

      if (!certificateResponse.ok) {
        console.error(
          "PPQCheck certificate GET failed:",
          certificateResponse.status,
          certificateRaw
        );

        continue;
      }

      const status =
        getStatus(certificateData.status);

      /*
       * ─────────────────────────────────────────
       * SUCCESS
       * ─────────────────────────────────────────
       */

      if (
        status === "success" ||
        status === "successful" ||
        status === "completed"
      ) {
        const actualCost =
          Number(certificateData.price);

        if (
          !Number.isFinite(actualCost) ||
          actualCost < 0
        ) {
          console.error(
            "PPQCheck: prezzo restituito non valido",
            certificateData
          );

          return NextResponse.json({
            success: true,
            status: "PROCESSING",
            orderId:
              reservation.orderId,
            ppqcheckOrderId,
            ppqcheck: certificateData,
          });
        }

        await completeSuccessfulOrder({
          orderId: reservation.orderId,
          actualCost,
          userId: session.user.id,
        });

        return NextResponse.json({
          success: true,
          status: "SUCCESS",
          orderId:
            reservation.orderId,
          ppqcheckOrderId,
          ppqcheck: certificateData,
        });
      }

      /*
       * Se PPQCheck ha esplicitamente fallito,
       * restituiamo i token.
       */

      if (
        status === "failed" ||
        status === "failure" ||
        status === "cancelled" ||
        status === "canceled"
      ) {
        console.error(
          "PPQCheck certificate failed:",
          certificateData
        );

        await failOrderAndRestoreTokens(
          reservation.orderId,
          reservation.requiredTokens,
          session.user.id
        );

        return NextResponse.json(
          {
            error:
              "PPQCheck non è riuscito a creare il certificato",
            status: certificateData.status,
            orderId:
              reservation.orderId,
            ppqcheckOrderId,
            ppqcheck: certificateData,
          },
          { status: 502 }
        );
      }
    }

    /*
     * Non è ancora terminato.
     *
     * NON restituiamo i token perché l'ordine
     * PPQCheck potrebbe essere ancora in lavorazione.
     */

    return NextResponse.json({
      success: true,
      status: "PROCESSING",
      orderId: reservation.orderId,
      ppqcheckOrderId,
    });
  } catch (error) {
    console.error(
      "Certificate create error:",
      error
    );

    if (
      error instanceof Error &&
      error.message ===
        "INSUFFICIENT_TOKENS"
    ) {
      return NextResponse.json(
        {
          error:
            "Token insufficienti",
        },
        { status: 400 }
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "USER_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          error:
            "Utente non trovato",
        },
        { status: 404 }
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "TOKEN_RESERVATION_FAILED"
    ) {
      return NextResponse.json(
        {
          error:
            "Impossibile riservare i token",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "Errore interno",
      },
      { status: 500 }
    );
  }
}

async function failOrderAndRestoreTokens(
  orderId: number,
  tokens: number,
  userId: number
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
      order.status === "FAILED" ||
      order.status === "CANCELLED"
    ) {
      return;
    }

    const user =
      await tx.orm.public.User
        .where({
          id: userId,
        })
        .first();

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    const tokenUpdate =
      tx.sql.public.user
        .update((f, fns) => ({
          tokenBalance:
            fns.raw`${f.tokenBalance} + ${tokens}`
              .returns("pg/int4@1"),
        }))
        .where((f, fns) =>
          fns.eq(f.id, userId)
        )
        .build();

    await tx.execute(tokenUpdate);

    await tx.orm.public.CertificateOrder
      .where({
        id: orderId,
      })
      .update({
        status: "FAILED",
      });
  });
}

async function completeSuccessfulOrder({
  orderId,
  actualCost,
  userId,
}: {
  orderId: number;
  actualCost: number;
  userId: number;
}) {
  await db.transaction(async (tx) => {
    const order =
      await tx.orm.public.CertificateOrder
        .where({
          id: orderId,
        })
        .first();

    if (!order) {
      throw new Error(
        "CERTIFICATE_ORDER_NOT_FOUND"
      );
    }

    if (order.status === "SUCCESS") {
      return;
    }

    /*
     * Registra il costo reale PPQCheck.
     *
     * NON modifica SyncCredit.
     */

    await tx.orm.public.PpqcheckTransaction.create({
      type: "CERTIFICATE_COST",
      amount: actualCost.toFixed(2),
      certificateOrderId: order.id,
      description:
        `PPQCheck certificate order ${order.ppqcheckOrderId}`,
    });

    /*
     * Registra il consumo dei token.
     *
     * I token erano già stati riservati
     * all'inizio dell'operazione.
     */

    await tx.orm.public.TokenTransaction.create({
      userId,
      amount: -order.tokens,
      type: "CERTIFICATE",
      orderId: order.id,
    });

    /*
     * Ordine completato.
     */

    await tx.orm.public.CertificateOrder
      .where({
        id: order.id,
      })
      .update({
        status: "SUCCESS",
      });
  });
}