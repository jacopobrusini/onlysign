import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getSession } from "@/lib/session";
import { param } from "@prisma/orm-postgres/relational-core/expression";

const PPQCHECK_API_URL =
  "https://br.api-developer.dev/v1/integration/certificate";

const PPQCHECK_BUDGET_PER_TOKEN = 1.4;

type PpqcheckCreateResponse = {
  id?: string;
  code?: string;
  status?: string;
  price?: number | string;
  currency?: string;
  requestedCurrency?: string;
  fellBack?: boolean;
};

function getPpqcheckStatus(status: string | undefined) {
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

    const requiredTokens = certificateType.tokens;

    const theoreticalFunding =
      requiredTokens * PPQCHECK_BUDGET_PER_TOKEN;

    /*
     * ─────────────────────────────────────────────
     * TRANSAZIONE ATOMICA
     * ─────────────────────────────────────────────
     */

    const reservation = await db.transaction(async (tx) => {
      const user = await tx.orm.public.User
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

      const syncCredit =
        await tx.orm.public.SyncCredit
          .where({
            id: 1,
          })
          .first();

      if (!syncCredit) {
        throw new Error("SYNC_CREDIT_NOT_INITIALIZED");
      }

      const coverage = Number(syncCredit.ppqCoverage);

      if (!Number.isFinite(coverage)) {
        throw new Error("INVALID_SYNC_CREDIT");
      }

      if (coverage < theoreticalFunding) {
        throw new Error("INSUFFICIENT_PPQ_COVERAGE");
      }

      /*
       * Riserva token.
       *
       * La condizione sul saldo viene eseguita
       * direttamente dal database.
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
       * Verifichiamo il saldo dopo l'UPDATE.
       *
       * Se l'UPDATE condizionale non ha modificato
       * l'utente, il saldo rimane invariato.
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
       * Riserva copertura PPQCheck.
       */

      const theoreticalFundingParam = param(
        theoreticalFunding.toFixed(2),
        {
          codecId: "pg/numeric@1",
        }
      );

      const coverageUpdate =
        tx.sql.public.syncCredit
          .update((f, fns) => ({
            ppqCoverage:
              fns.raw`${f.ppqCoverage} - ${theoreticalFundingParam}`
                .returns("pg/numeric@1"),
          }))
          .where((f, fns) =>
            fns.and(
              fns.eq(f.id, syncCredit.id),
              fns.raw`${f.ppqCoverage} >= ${theoreticalFundingParam}`
                .returns("pg/bool@1")
            )
          )
          .build();

      await tx.execute(coverageUpdate);

      /*
       * Verifichiamo la copertura dopo l'UPDATE.
       */

      const updatedSyncCredit =
        await tx.orm.public.SyncCredit
          .where({
            id: syncCredit.id,
          })
          .first();

      if (!updatedSyncCredit) {
        throw new Error(
          "SYNC_CREDIT_NOT_INITIALIZED"
        );
      }

      const expectedCoverage =
        coverage - theoreticalFunding;

      const actualCoverage =
        Number(updatedSyncCredit.ppqCoverage);

      if (
        !Number.isFinite(actualCoverage) ||
        Math.abs(
          actualCoverage - expectedCoverage
        ) > 0.000001
      ) {
        throw new Error(
          "COVERAGE_RESERVATION_FAILED"
        );
      }

      /*
       * Crea l'ordine.
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
        certificateId: certificateType.ppqcheckId,
        theoreticalFunding,
      };
    });

    /*
     * ─────────────────────────────────────────────
     * PPQCHECK
     * ─────────────────────────────────────────────
     */

    const apiKey = process.env.PPQCHECK_API_KEY;

    if (!apiKey) {
      console.error(
        "PPQCheck: API key non configurata"
      );

      await restoreReservation(
        reservation.orderId,
        reservation.theoreticalFunding,
        requiredTokens,
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

    const ppqcheckResponse = await fetch(
      PPQCHECK_API_URL,
      {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          udid: reservation.deviceUdid,
          certificateId:
            reservation.certificateId,
          deviceType: "iphone",
        }),
      }
    );

    const responseText =
      await ppqcheckResponse.text();

    let ppqcheckData: PpqcheckCreateResponse = {};

    try {
      ppqcheckData =
        JSON.parse(responseText) as PpqcheckCreateResponse;
    } catch {
      console.error(
        "PPQCheck: risposta non JSON",
        ppqcheckResponse.status,
        responseText
      );
    }

    if (!ppqcheckResponse.ok) {
      console.error(
        "PPQCheck create certificate failed:",
        ppqcheckResponse.status,
        responseText
      );

      await restoreReservation(
        reservation.orderId,
        reservation.theoreticalFunding,
        requiredTokens,
        session.user.id
      );

      return NextResponse.json(
        {
          error:
            "Impossibile creare il certificato PPQCheck",
        },
        { status: 502 }
      );
    }

    const ppqcheckOrderId =
      ppqcheckData.id;

    if (!ppqcheckOrderId) {
      console.error(
        "PPQCheck: ID ordine mancante",
        ppqcheckData
      );

      await restoreReservation(
        reservation.orderId,
        reservation.theoreticalFunding,
        requiredTokens,
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

    await db.orm.public.CertificateOrder
      .where({
        id: reservation.orderId,
      })
      .update({
        ppqcheckOrderId,
      });

    const status =
      getPpqcheckStatus(ppqcheckData.status);

    /*
     * ─────────────────────────────────────────────
     * SUCCESS IMMEDIATO
     * ─────────────────────────────────────────────
     */

    if (
      status === "success" ||
      status === "successful" ||
      status === "completed"
    ) {
      const actualCost =
        Number(ppqcheckData.price);

      if (
        !Number.isFinite(actualCost) ||
        actualCost < 0
      ) {
        console.error(
          "PPQCheck: costo non valido",
          ppqcheckData
        );

        return NextResponse.json({
          success: true,
          status: "PROCESSING",
          orderId: reservation.orderId,
          ppqcheckOrderId,
        });
      }

      await completeSuccessfulOrder({
        orderId: reservation.orderId,
        ppqcheckOrderId,
        actualCost,
        userId: session.user.id,
      });

      return NextResponse.json({
        success: true,
        status: "SUCCESS",
        orderId: reservation.orderId,
        ppqcheckOrderId,
      });
    }

    /*
     * ─────────────────────────────────────────────
     * ORDINE ASINCRONO
     * ─────────────────────────────────────────────
     */

    return NextResponse.json({
      success: true,
      status:
        status || "PROCESSING",
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
      error.message === "INSUFFICIENT_TOKENS"
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
        "INSUFFICIENT_PPQ_COVERAGE"
    ) {
      return NextResponse.json(
        {
          error:
            "Credito PPQCheck insufficiente",
        },
        { status: 409 }
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
      error.message === "USER_NOT_FOUND"
    ) {
      return NextResponse.json(
        { error: "Utente non trovato" },
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

    if (
      error instanceof Error &&
      error.message ===
        "COVERAGE_RESERVATION_FAILED"
    ) {
      return NextResponse.json(
        {
          error:
            "Impossibile riservare il credito PPQCheck",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Errore interno" },
      { status: 500 }
    );
  }
}

async function restoreReservation(
  orderId: number,
  theoreticalFunding: number,
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

    /*
     * Restituisci token.
     */

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

    /*
     * Restituisci copertura teorica.
     */

    const syncCredit =
      await tx.orm.public.SyncCredit
        .where({
          id: 1,
        })
        .first();

    if (syncCredit) {
      const theoreticalFundingParam = param(
        theoreticalFunding.toFixed(2),
        {
          codecId: "pg/numeric@1",
        }
      );

      const coverageUpdate =
        tx.sql.public.syncCredit
          .update((f, fns) => ({
            ppqCoverage:
              fns.raw`${f.ppqCoverage} + ${theoreticalFundingParam}`
                .returns("pg/numeric@1"),
          }))
          .where((f, fns) =>
            fns.eq(f.id, syncCredit.id)
          )
          .build();

      await tx.execute(coverageUpdate);
    }

    /*
     * Ordine fallito.
     */

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
  ppqcheckOrderId,
  actualCost,
  userId,
}: {
  orderId: number;
  ppqcheckOrderId: string;
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
     * La copertura teorica era stata riservata.
     *
     * Ora restituiamo il costo reale.
     *
     * Esempio 1 token:
     *
     * -1.40 +1.20 = -0.20
     *
     * Quindi il sistema libera esattamente
     * $0.20 di copertura.
     */

    const actualCostParam = param(
      actualCost.toFixed(2),
      {
        codecId: "pg/numeric@1",
      }
    );

    const coverageUpdate =
      tx.sql.public.syncCredit
        .update((f, fns) => ({
          ppqCoverage:
            fns.raw`${f.ppqCoverage} + ${actualCostParam}`
              .returns("pg/numeric@1"),
        }))
        .where((f, fns) =>
          fns.eq(f.id, syncCredit.id)
        )
        .build();

    await tx.execute(coverageUpdate);

    /*
     * Registra il costo reale PPQCheck.
     */

    await tx.orm.public.PpqcheckTransaction.create({
      type: "CERTIFICATE_COST",
      amount: actualCost.toFixed(2),
      certificateOrderId: order.id,
      description:
        `PPQCheck certificate order ${ppqcheckOrderId}`,
    });

    /*
     * Registra il consumo dei token.
     *
     * Il saldo era già stato riservato all'inizio
     * dell'operazione.
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