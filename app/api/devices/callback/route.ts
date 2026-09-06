import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { parseProfileServiceResponse } from "@udid-tools/core";

import { db } from "@/prisma/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.arrayBuffer();

    if (body.byteLength === 0) {
      return new NextResponse("Invalid request.", {
        status: 400,
      });
    }

    /*
     * Apple invia una risposta CMS/PKCS#7.
     *
     * @udid-tools/core:
     * - decodifica il CMS
     * - verifica la firma
     * - estrae il plist
     * - estrae gli attributi del dispositivo
     * - estrae il CHALLENGE
     */
    const result = await parseProfileServiceResponse(body, {
      requiredAttributes: ["UDID"],

      verification: {
        mode: "signature",
      },
    });

    if (!result.ok) {
      console.error(
        "Device response rejected:",
        result.error
      );

      return new NextResponse(
        "Invalid device response.",
        {
          status: 400,
        }
      );
    }

    const response = result.value;

    console.log("=== DEVICE RESPONSE ===");
    console.log("Attributes:", response.attributes);
    console.log("Challenge:", response.challenge);
    console.log("Signature:", response.signature);

    /*
     * UDID
     */
    const udid = response.attributes.udid?.trim();

    if (!udid) {
      return new NextResponse(
        "Missing device UDID.",
        {
          status: 400,
        }
      );
    }

    /*
     * CHALLENGE
     *
     * Il challenge può essere una stringa oppure Uint8Array.
     */
    let challenge: string;

    if (typeof response.challenge === "string") {
      challenge = response.challenge;
    } else if (response.challenge instanceof Uint8Array) {
      challenge = new TextDecoder().decode(
        response.challenge
      );
    } else {
      return new NextResponse(
        "Missing challenge.",
        {
          status: 400,
        }
      );
    }

    challenge = challenge.trim();

    if (!challenge) {
      return new NextResponse(
        "Missing challenge.",
        {
          status: 400,
        }
      );
    }

    /*
     * Il challenge viene cercato tramite SHA-256.
     */
    const tokenHash = createHash("sha256")
      .update(challenge)
      .digest("hex");

    const registration =
      await db.orm.public.DeviceRegistration
        .where({ tokenHash })
        .first();

    if (!registration) {
      return new NextResponse(
        "Invalid or expired registration.",
        {
          status: 403,
        }
      );
    }

    /*
     * Verifica scadenza.
     */
    if (
      Temporal.Instant.compare(
        Temporal.Now.instant(),
        registration.expiresAt
      ) > 0
    ) {
      await db.orm.public.DeviceRegistration
        .where({ id: registration.id })
        .delete();

      return new NextResponse(
        "Registration expired.",
        {
          status: 410,
        }
      );
    }

    /*
     * Verifica che la firma CMS sia presente e valida.
     */
    if (
      response.signature.present !== true ||
      response.signature.valid !== true
    ) {
      console.error(
        "Invalid device signature:",
        response.signature
      );

      return new NextResponse(
        "Invalid device signature.",
        {
          status: 400,
        }
      );
    }

    /*
     * DEVICE_NAME non fa parte degli attributi normalizzati
     * dalla libreria, quindi lo leggiamo dal plist originale.
     */
    const rawDeviceName = response.raw[
      "DEVICE_NAME"
    ];

    const deviceName =
      typeof rawDeviceName === "string"
        ? rawDeviceName.trim() || null
        : null;

    /*
     * Controlliamo se l'UDID è già registrato.
     */
    const existingDevice =
      await db.orm.public.Device
        .where({ udid })
        .first();

    if (existingDevice) {
      await db.orm.public.DeviceRegistration
        .where({ id: registration.id })
        .delete();

      return new NextResponse(
        "Device already registered.",
        {
          status: 409,
        }
      );
    }

    /*
     * Registriamo il dispositivo.
     */
    await db.orm.public.Device.create({
      userId: registration.userId,

      udid,

      name: deviceName,

      model:
        response.attributes.product?.trim() || null,

      product:
        response.attributes.product?.trim() || null,

      osVersion:
        response.attributes.version?.trim() || null,
    });

    /*
     * Il challenge è monouso.
     */
    await db.orm.public.DeviceRegistration
      .where({ id: registration.id })
      .delete();

    console.log(
      "Device registered successfully:",
      udid
    );

    /*
     * Risposta finale mostrata da iOS/Safari.
     */
    return new NextResponse(
      `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >
    <title>onlySign - Dispositivo registrato</title>
</head>

<body style="
    margin: 0;
    padding: 40px 20px;
    background: #050505;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    text-align: center;
">

    <div style="
        max-width: 500px;
        margin: 80px auto;
        padding: 40px 25px;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 24px;
        background: rgba(255,255,255,.05);
    ">

        <h1 style="
            margin-bottom: 12px;
        ">
            Dispositivo registrato
        </h1>

        <p style="
            color: rgba(255,255,255,.6);
            line-height: 1.6;
        ">
            Il tuo dispositivo è stato registrato
            correttamente su onlySign.
        </p>

        <a
            href="/dashboard/dispositivi"
            style="
                display: inline-block;
                margin-top: 25px;
                padding: 12px 20px;
                border-radius: 12px;
                background: white;
                color: black;
                text-decoration: none;
                font-weight: 600;
            "
        >
            Vai ai dispositivi
        </a>

    </div>

</body>
</html>`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Device callback error:",
      error
    );

    return new NextResponse(
      "An error occurred while registering the device.",
      {
        status: 500,
      }
    );
  }
}