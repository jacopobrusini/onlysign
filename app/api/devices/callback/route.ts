import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { parse } from "plist";

import { db } from "@/prisma/db";

export const runtime = "nodejs";

type DeviceResponse = {
  UDID?: string;
  DEVICE_NAME?: string;
  VERSION?: string;
  PRODUCT?: string;
  CHALLENGE?: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.text();
    console.log("=== DEVICE CALLBACK ===");
console.log("Content-Type:", request.headers.get("content-type"));
console.log("Body:", body);

    if (!body) {
      return new NextResponse("Invalid request.", {
        status: 400,
      });
    }

    let deviceData: DeviceResponse;

    try {
      deviceData = parse(body) as DeviceResponse;
    } catch (error) {
      console.error("Invalid plist:", error);

      return new NextResponse("Invalid plist.", {
        status: 400,
      });
    }

    const challenge = deviceData.CHALLENGE?.trim();
    const udid = deviceData.UDID?.trim();

    if (!challenge) {
      return new NextResponse("Missing challenge.", {
        status: 400,
      });
    }

    if (!udid) {
      return new NextResponse("Missing UDID.", {
        status: 400,
      });
    }

    /*
     * Il challenge ricevuto dall'iPhone viene hashato
     * nello stesso modo utilizzato durante la creazione
     * del profilo.
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
     * Controlliamo la scadenza.
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
     * Evitiamo di registrare due volte lo stesso UDID.
     */
    const existingDevice =
      await db.orm.public.Device
        .where({ udid })
        .first();

    if (existingDevice) {
      // Il challenge è monouso anche in questo caso.
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
     * Creiamo il dispositivo associandolo
     * all'utente che ha generato il challenge.
     */
    await db.orm.public.Device.create({
      userId: registration.userId,
      udid,
      name: deviceData.DEVICE_NAME?.trim() || null,
      model: deviceData.PRODUCT?.trim() || null,
      product: deviceData.PRODUCT?.trim() || null,
      osVersion: deviceData.VERSION?.trim() || null,
    });

    /*
     * Challenge monouso:
     * dopo una registrazione riuscita non può più essere riutilizzato.
     */
    await db.orm.public.DeviceRegistration
      .where({ id: registration.id })
      .delete();

    return new NextResponse(
      `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
        <h1 style="margin-bottom: 12px;">
            Dispositivo registrato
        </h1>

        <p style="color: rgba(255,255,255,.6);">
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
    console.error("Device callback error:", error);

    return new NextResponse(
      "An error occurred while registering the device.",
      {
        status: 500,
      }
    );
  }
}