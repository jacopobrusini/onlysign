import forge from "node-forge";
import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { parseProfileServiceResponse } from "@udid-tools/core";

import { db } from "@/prisma/db";

export const runtime = "nodejs";

/*
 * ============================================================
 * Crea il configuration profile che verrà restituito
 * all'iPhone dopo la registrazione.
 * ============================================================
 */
function createConfigurationProfile() {
  const payloadUUID = randomUUID().toUpperCase();
  const scepUUID = randomUUID().toUpperCase();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const scepUrl = `${appUrl}/api/devices/scep`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>

    <key>PayloadVersion</key>
    <integer>1</integer>

    <key>PayloadUUID</key>
    <string>${payloadUUID}</string>

    <key>PayloadType</key>
    <string>Configuration</string>

    <key>PayloadIdentifier</key>
    <string>it.onlysign.device-registration</string>

    <key>PayloadDisplayName</key>
    <string>onlySign - Registrazione dispositivo</string>

    <key>PayloadDescription</key>
    <string>Registrazione del dispositivo su onlySign.</string>

    <key>PayloadOrganization</key>
    <string>onlySign</string>

    <key>PayloadContent</key>
    <array>

        <dict>

              <key>URL</key>
    <string>${scepUrl}</string>

    <key>Key Type</key>
    <string>RSA</string>

    <key>Keysize</key>
    <integer>2048</integer>

    <key>Key Usage</key>
    <integer>5</integer>

            <key>PayloadVersion</key>
            <integer>1</integer>

            <key>PayloadUUID</key>
            <string>${scepUUID}</string>

            <key>PayloadType</key>
            <string>com.apple.security.scep</string>

            <key>PayloadIdentifier</key>
            <string>it.onlysign.scep</string>

            <key>PayloadDisplayName</key>
            <string>onlySign Device Identity</string>

            <key>PayloadDescription</key>
            <string>Identità del dispositivo onlySign.</string>

            <key>PayloadOrganization</key>
            <string>onlySign</string>

            <key>PayloadContent</key>
            <dict>

                <key>URL</key>
                <string>${scepUrl}</string>

                <key>Key Type</key>
                <string>RSA</string>

                <key>Key Usage</key>
                <integer>5</integer>

            </dict>

        </dict>

    </array>

</dict>
</plist>`;
}

/*
 * ============================================================
 * Firma il configuration profile con il certificato contenuto
 * nel PKCS#12.
 *
 * Le credenziali vengono lette esclusivamente dalle variabili
 * d'ambiente server-side.
 * ============================================================
 */
async function signConfigurationProfile(
  configuration: string
): Promise<Uint8Array> {
  const p12Base64 =
    process.env.ONLYSIGN_PROFILE_P12_BASE64;

  const p12Password =
    process.env.ONLYSIGN_PROFILE_P12_PASSWORD;

  if (!p12Base64) {
    throw new Error(
      "ONLYSIGN_PROFILE_P12_BASE64 non configurata."
    );
  }

  if (p12Password === undefined) {
    throw new Error(
      "ONLYSIGN_PROFILE_P12_PASSWORD non configurata."
    );
  }

  /*
   * ----------------------------------------------------------
   * Base64 → DER
   * ----------------------------------------------------------
   */
  const p12Der =
    forge.util.decode64(p12Base64);

  /*
   * ----------------------------------------------------------
   * DER → ASN.1
   * ----------------------------------------------------------
   */
  const asn1 =
    forge.asn1.fromDer(p12Der);

  /*
   * ----------------------------------------------------------
   * ASN.1 → PKCS#12
   * ----------------------------------------------------------
   */
  const p12 =
    forge.pkcs12.pkcs12FromAsn1(
      asn1,
      false,
      p12Password
    );

  /*
   * ----------------------------------------------------------
   * Recuperiamo la chiave privata.
   * ----------------------------------------------------------
   */
  const keyBags =
    p12.getBags({
      bagType:
        forge.pki.oids.pkcs8ShroudedKeyBag,
    })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] ?? [];

  /*
   * ----------------------------------------------------------
   * Recuperiamo i certificati.
   * ----------------------------------------------------------
   */
  const certBags =
    p12.getBags({
      bagType:
        forge.pki.oids.certBag,
    })[
      forge.pki.oids.certBag
    ] ?? [];

  const keyBag = keyBags[0];
  const certBag = certBags[0];

  if (!keyBag?.key) {
    throw new Error(
      "Chiave privata non trovata nel PKCS#12."
    );
  }

  if (!certBag?.cert) {
    throw new Error(
      "Certificato non trovato nel PKCS#12."
    );
  }

  const privateKey = keyBag.key;
  const certificate = certBag.cert;

  /*
   * ----------------------------------------------------------
   * Prepariamo il contenuto da firmare.
   * ----------------------------------------------------------
   */
  const content =
    forge.util.createBuffer(
      configuration,
      "utf8"
    );

  /*
   * ----------------------------------------------------------
   * Creiamo CMS / PKCS#7 SignedData.
   * ----------------------------------------------------------
   */
  const signedData =
    forge.pkcs7.createSignedData();

  signedData.content = content;

  /*
   * Inseriamo il certificato del signer.
   */
  signedData.addCertificate(
    certificate
  );

  /*
   * ----------------------------------------------------------
   * Configuriamo la firma RSA + SHA-256.
   * ----------------------------------------------------------
   */
  signedData.addSigner({
    certificate,
    key: privateKey,

    digestAlgorithm:
      forge.pki.oids.sha256,

    authenticatedAttributes: [
      {
        type:
          forge.pki.oids.contentType,

        value:
          forge.pki.oids.data,
      },

      {
        type:
          forge.pki.oids.messageDigest,
      },

      {
        type:
          forge.pki.oids.signingTime,
      },
    ],
  });

  /*
   * ----------------------------------------------------------
   * Firma CMS attached.
   * ----------------------------------------------------------
   */
  signedData.sign({
    detached: false,
  });

  /*
   * ----------------------------------------------------------
   * CMS ASN.1 → DER.
   * ----------------------------------------------------------
   */
  const der =
    forge.asn1
      .toDer(
        signedData.toAsn1()
      )
      .getBytes();

  /*
   * Buffer Node → Uint8Array.
   *
   * Uint8Array evita il problema TypeScript:
   * Buffer<ArrayBufferLike> non assignable to BodyInit.
   */
  const result = new Uint8Array(
  der.length
);

for (let i = 0; i < der.length; i++) {
  result[i] = der.charCodeAt(i) & 0xff;
}

return result;
}

/*
 * ============================================================
 * PROFILE SERVICE CALLBACK
 * ============================================================
 */
export async function POST(
  request: Request
) {
  try {
    /*
     * ----------------------------------------------------------
     * Riceviamo la risposta PKCS#7 dell'iPhone.
     * ----------------------------------------------------------
     */
    const body =
      await request.arrayBuffer();

    if (body.byteLength === 0) {
      return new NextResponse(
        "Invalid request.",
        {
          status: 400,
        }
      );
    }

    /*
     * ========================================================
     * iPhone → server
     *
     * Il dispositivo invia un CMS / PKCS#7 contenente:
     *
     * UDID
     * DEVICE_NAME
     * VERSION
     * PRODUCT
     * CHALLENGE
     * ========================================================
     */
    const result =
      await parseProfileServiceResponse(
        body,
        {
          requiredAttributes: [
            "UDID",
          ],

          verification: {
            mode: "signature",
          },
        }
      );

    /*
     * ----------------------------------------------------------
     * Il PKCS#7 non è valido.
     * ----------------------------------------------------------
     */
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

    const response =
      result.value;

    console.log(
      "=== DEVICE RESPONSE ==="
    );

    console.log(
      "Attributes:",
      response.attributes
    );

    console.log(
      "Challenge:",
      response.challenge
    );

    console.log(
      "Signature:",
      response.signature
    );

    /*
     * ========================================================
     * Verifica firma del dispositivo
     * ========================================================
     */
    if (
      response.signature.present !==
        true ||
      response.signature.valid !==
        true
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
     * ========================================================
     * UDID
     * ========================================================
     */
    const udid =
      response.attributes.udid?.trim();

    if (!udid) {
      return new NextResponse(
        "Missing device UDID.",
        {
          status: 400,
        }
      );
    }

    /*
     * ========================================================
     * CHALLENGE
     * ========================================================
     */
    let challenge: string;

    if (
      typeof response.challenge ===
      "string"
    ) {
      challenge =
        response.challenge;
    } else if (
      response.challenge instanceof
      Uint8Array
    ) {
      challenge =
        new TextDecoder().decode(
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

    challenge =
      challenge.trim();

    if (!challenge) {
      return new NextResponse(
        "Missing challenge.",
        {
          status: 400,
        }
      );
    }

    /*
     * ========================================================
     * Recuperiamo la registrazione temporanea.
     * ========================================================
     */
    const tokenHash =
      createHash("sha256")
        .update(challenge)
        .digest("hex");

    const registration =
      await db.orm.public.DeviceRegistration
        .where({
          tokenHash,
        })
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
     * ========================================================
     * Controllo scadenza.
     * ========================================================
     */
    if (
      Temporal.Instant.compare(
        Temporal.Now.instant(),
        registration.expiresAt
      ) > 0
    ) {
      await db.orm.public.DeviceRegistration
        .where({
          id: registration.id,
        })
        .delete();

      return new NextResponse(
        "Registration expired.",
        {
          status: 410,
        }
      );
    }

    /*
     * ========================================================
     * Nome dispositivo.
     * ========================================================
     */
    const rawDeviceName =
      response.raw["DEVICE_NAME"];

    const deviceName =
      typeof rawDeviceName ===
      "string"
        ? rawDeviceName.trim() ||
          null
        : null;

    /*
     * ========================================================
     * Controlliamo se l'UDID è già registrato.
     * ========================================================
     */
    const existingDevice =
      await db.orm.public.Device
        .where({
          udid,
        })
        .first();

    if (existingDevice) {
      await db.orm.public.DeviceRegistration
        .where({
          id: registration.id,
        })
        .delete();

      return new NextResponse(
        "Device already registered.",
        {
          status: 409,
        }
      );
    }

    /*
     * ========================================================
     * Salviamo il dispositivo.
     * ========================================================
     */
    await db.orm.public.Device.create({
      userId:
        registration.userId,

      udid,

      name: deviceName,

      model:
        response.attributes.product?.trim() ||
        null,

      product:
        response.attributes.product?.trim() ||
        null,

      osVersion:
        response.attributes.version?.trim() ||
        null,
    });

    console.log(
      "Device registered successfully:",
      udid
    );

    /*
     * ========================================================
     * Creiamo il configuration profile.
     * ========================================================
     */
    const configuration =
      createConfigurationProfile();

    /*
     * ========================================================
     * Firmiamo il configuration profile.
     * ========================================================
     */
    console.log(
  "=== CONFIGURATION PROFILE ==="
);

console.log(configuration);

console.log(
  "=== END CONFIGURATION PROFILE ==="
);
    const signedConfiguration =
      await signConfigurationProfile(
        configuration
      );
      console.log(
  "Signed configuration size:",
  signedConfiguration.byteLength
);

    /*
     * ========================================================
     * Registrazione completata.
     *
     * Il challenge è one-time, quindi possiamo eliminarlo.
     * ========================================================
     */
    await db.orm.public.DeviceRegistration
      .where({
        id: registration.id,
      })
      .delete();

    /*
     * ========================================================
     * Restituiamo a iOS il CMS / PKCS#7.
     * ========================================================
     */
    const responseBuffer = new ArrayBuffer(
  signedConfiguration.byteLength
);

new Uint8Array(responseBuffer).set(
  signedConfiguration
);

return new NextResponse(
  responseBuffer,
  {
    status: 200,
    headers: {
      "Content-Type":
        "application/x-apple-aspen-config",

      "Content-Length":
        signedConfiguration.byteLength.toString(),

      "Cache-Control":
        "no-store",
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