import forge from "node-forge";
import { build as buildPlist } from "plist";
import type { PlistValue } from "plist";
import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { parseProfileServiceResponse } from "@udid-tools/core";

import { db } from "@/prisma/db";

export const runtime = "nodejs";

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function bytesToUint8Array(bytes: string): Uint8Array {
  const result = new Uint8Array(bytes.length);

  for (let i = 0; i < bytes.length; i++) {
    result[i] = bytes.charCodeAt(i) & 0xff;
  }

  return result;
}

function uint8ArrayToBinary(bytes: Uint8Array): string {
  let result = "";

  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    result += String.fromCharCode(
      ...bytes.subarray(
        i,
        Math.min(i + chunkSize, bytes.length)
      )
    );
  }

  return result;
}

/*
 * ============================================================
 * Crea il configuration profile iniziale che verrà restituito
 * all'iPhone dopo il primo callback.
 *
 * Questo profilo contiene il payload SCEP.
 * ============================================================
 */

function createConfigurationProfile(challenge: string) {
  const payloadUUID = randomUUID().toUpperCase();

  const scepUUID = randomUUID().toUpperCase();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const scepUrl = `${appUrl}/api/devices/scep`;

  return `<?xml version="1.0" encoding="UTF-8"?>

<!DOCTYPE plist PUBLIC "-//Apple Inc//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">

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
<string>Registrazione dispositivo</string>

<key>PayloadDescription</key>
<string>Questo profilo è necessario per completare la registrazione del tuo dispositivo su onlySign. Viene utilizzato durante la procedura per verificare l'identità del dispositivo e associarlo al tuo account. Il profilo non consente a onlySign di accedere ai tuoi dati personali, alle tue foto o ai tuoi contenuti.</string>

<key>PayloadOrganization</key>
<string>onlySign</string>

<key>PayloadContent</key>
<array>

    <dict>

        <key>PayloadContent</key>
        <dict>

            <key>URL</key>
            <string>${scepUrl}</string>

            <key>Name</key>
            <string>onlySignDevice</string>

            <key>Subject</key>
            <array>
                <array>
                    <array>
                        <string>O</string>
                        <string>onlySign</string>
                    </array>
                </array>
                <array>
                    <array>
                        <string>CN</string>
                        <string>onlySign Device</string>
                    </array>
                </array>
            </array>

            <key>Challenge</key>
            <string>${challenge}</string>

            <key>Keysize</key>
            <integer>2048</integer>

            <key>Key Type</key>
            <string>RSA</string>

            <key>Key Usage</key>
            <integer>5</integer>

        </dict>

        <key>PayloadDescription</key>
        <string>Identità temporanea utilizzata da onlySign per verificare e registrare in modo sicuro questo dispositivo.</string>

        <key>PayloadUUID</key>
        <string>${scepUUID}</string>

        <key>PayloadType</key>
        <string>com.apple.security.scep</string>

        <key>PayloadDisplayName</key>
        <string>onlySign — Identità temporanea del dispositivo</string>

        <key>PayloadVersion</key>
        <integer>1</integer>

        <key>PayloadOrganization</key>
        <string>onlySign</string>

        <key>PayloadIdentifier</key>
        <string>it.onlysign.scep</string>

    </dict>

</array>

</dict>
</plist>`;
}

/*
 * ============================================================
 * Firma un configuration profile con il certificato contenuto
 * nel PKCS#12.
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
   * Base64 → DER
   */
  const p12Der = forge.util.decode64(p12Base64);

  /*
   * DER → ASN.1
   */
  const asn1 = forge.asn1.fromDer(p12Der);

  /*
   * ASN.1 → PKCS#12
   */
  const p12 = forge.pkcs12.pkcs12FromAsn1(
    asn1,
    false,
    p12Password
  );

  /*
   * Recuperiamo la chiave privata.
   */
  const keyBags =
    p12.getBags({
      bagType:
        forge.pki.oids.pkcs8ShroudedKeyBag,
    })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] ?? [];

  /*
   * Recuperiamo i certificati.
   */
  const certBags =
    p12.getBags({
      bagType: forge.pki.oids.certBag,
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
   * Prepariamo il contenuto.
   */
  const content = forge.util.createBuffer(
    configuration,
    "utf8"
  );

  /*
   * CMS / PKCS#7 SignedData.
   */
  const signedData =
    forge.pkcs7.createSignedData();

  signedData.content = content;

  signedData.addCertificate(
    certificate
  );

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
   * Firma CMS attached.
   */
  signedData.sign({
    detached: false,
  });

  /*
   * CMS ASN.1 → DER.
   */
  const der = forge.asn1
    .toDer(signedData.toAsn1())
    .getBytes();

  return bytesToUint8Array(der);
}

/*
 * ============================================================
 * Estrae il certificato del signer dal CMS ricevuto.
 *
 * Nel primo callback il signer è Apple.
 *
 * Nel secondo callback il signer è il certificato
 * "onlySign Device" appena emesso da SCEP.
 * ============================================================
 */

function extractSignerCertificate(
  body: ArrayBuffer
): forge.pki.Certificate {
  const binary = uint8ArrayToBinary(
    new Uint8Array(body)
  );

  const asn1 = forge.asn1.fromDer(binary);

  /*
   * Il callback Profile Service è un CMS SignedData.
   */
  const message =
    forge.pkcs7.messageFromAsn1(asn1);

  /*
   * Le typings di node-forge espongono message come
   * union SignedData | EnvelopedData.
   *
   * Qui ci interessa la proprietà certificates
   * presente nel SignedData.
   */
  const signedData =
    message as unknown as {
      certificates?: forge.pki.Certificate[];
    };

  /*
   * Recuperiamo i certificati inclusi nel CMS.
   */
  const certificates =
    signedData.certificates;

  if (
    !certificates ||
    certificates.length === 0
  ) {
    throw new Error(
      "Nessun certificato trovato nel CMS del dispositivo."
    );
  }

  /*
   * Il primo certificato è il signer del callback.
   */
  const certificate = certificates[0];

  if (!certificate) {
    throw new Error(
      "Certificato signer non disponibile."
    );
  }

  return certificate;
}

/*
 * ============================================================
 * Crea il payload finale da installare sul dispositivo.
 *
 * Il certificato SCEP è già stato installato durante la fase
 * precedente.
 *
 * Il payload finale serve a completare la procedura OTA.
 * ============================================================
 */

function createFinalPayloads(): PlistValue[] {
  const payloadUUID =
    randomUUID().toUpperCase();

  return [
    {
      PayloadVersion: 1,

      PayloadUUID:
        payloadUUID,

      PayloadType:
        "com.apple.webClip.managed",

      PayloadIdentifier:
        "it.onlysign.final.webclip",

      PayloadDisplayName:
        "onlySign",

      PayloadDescription:
        "Accesso rapido a onlySign.",

      PayloadOrganization:
        "onlySign",

      IsRemovable: true,

      Label:
        "onlySign",

      URL:
        process.env.NEXT_PUBLIC_APP_URL ??
        "https://onlysign.vercel.app",
    },
  ];
}

/*
 * ============================================================
 * Serializza il PayloadContent finale.
 *
 * Apple specifica che per EncryptedPayloadContent il contenuto
 * da cifrare deve essere una property list il cui oggetto
 * principale è un ARRAY, non un dizionario.
 * ============================================================
 */

function serializeFinalPayloads(
  payloads: PlistValue[]
): string {
  return buildPlist(payloads);
}

/*
 * ============================================================
 * Cifra il PayloadContent finale con il certificato del
 * dispositivo.
 *
 * Apple OTA utilizza CMS / PKCS#7 EnvelopedData.
 *
 * Usiamo 3DES-CBC per allinearci alla reference implementation
 * Apple.
 * ============================================================
 */

function encryptFinalPayload(
  payload: string,
  deviceCertificate: forge.pki.Certificate
): Uint8Array {
  const envelopedData =
    forge.pkcs7.createEnvelopedData();

  /*
   * Il certificato del dispositivo contiene la chiave
   * pubblica corrispondente alla chiave privata presente
   * nel keychain dell'iPhone.
   */
  envelopedData.addRecipient(
    deviceCertificate
  );

  /*
   * Payload da cifrare.
   */
  envelopedData.content =
    forge.util.createBuffer(
      payload,
      "utf8"
    );

  /*
   * Apple usa 3DES-CBC nella reference implementation.
   */
  envelopedData.encrypt(
    undefined,
    forge.pki.oids["des-EDE3-CBC"]
  );

  /*
   * EnvelopedData → DER.
   */
  const der = forge.asn1
    .toDer(envelopedData.toAsn1())
    .getBytes();

  return bytesToUint8Array(der);
}

/*
 * ============================================================
 * Crea il configuration profile finale cifrato.
 *
 * Struttura:
 *
 * Configuration
 * ├── PayloadVersion
 * ├── PayloadUUID
 * ├── PayloadType
 * ├── PayloadIdentifier
 * ├── PayloadDisplayName
 * ├── PayloadDescription
 * ├── PayloadOrganization
 * └── EncryptedPayloadContent
 *
 * PayloadContent NON viene incluso nel profilo esterno.
 * ============================================================
 */

function createFinalConfigurationProfile(
  encryptedPayload: Uint8Array
): string {
  const payloadUUID =
    randomUUID().toUpperCase();

  return buildPlist({
    PayloadVersion: 1,

    PayloadUUID:
      payloadUUID,

    PayloadType:
      "Configuration",

    PayloadIdentifier:
      "it.onlysign.final",

    PayloadDisplayName:
      "Registrazione dispositivo",

    PayloadDescription:
      "Registrazione del dispositivo su onlySign completata, è possibile rimuovere questo profilo.",

    PayloadOrganization:
      "onlySign",

    EncryptedPayloadContent:
      Buffer.from(
        encryptedPayload
      ),
  });
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
     * Riceviamo la risposta PKCS#7 dell'iPhone.
     */
    const body =
      await request.arrayBuffer();

    if (
      body.byteLength === 0
    ) {
      return new NextResponse(
        "Invalid request.",
        {
          status: 400,
        }
      );
    }

    /*
     * ========================================================
     * Parse della risposta Profile Service.
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
     * PKCS#7 non valido.
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
     * Verifica firma.
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
     * SECONDO CALLBACK
     *
     * Dopo SCEP:
     *
     * - challenge assente
     * - firma valida
     * - signer = certificato onlySign Device
     *
     * Questo NON è un callback da ignorare.
     *
     * È la richiesta del profilo finale.
     * ========================================================
     */

    if (
      response.challenge === undefined ||
      response.challenge === null
    ) {
      console.log(
        "=== FINAL OTA PROFILE REQUEST ==="
      );

      /*
       * Il dispositivo deve essere già registrato.
       */

      const existingDevice =
        await db.orm.public.Device
          .where({
            udid,
          })
          .first();

      if (!existingDevice) {
        console.error(
          "Final profile requested for unknown device:",
          udid
        );

        return new NextResponse(
          "Unknown device.",
          {
            status: 403,
          }
        );
      }

      /*
       * ======================================================
       * Estraiamo il certificato del signer direttamente
       * dal CMS ricevuto.
       *
       * NON usiamo response.signature.signers perché quello
       * contiene informazioni descrittive e non l'oggetto
       * X.509 necessario per la cifratura.
       * ======================================================
       */

      const deviceCertificate =
        extractSignerCertificate(
          body
        );

      console.log(
        "Final profile signer subject:",
        deviceCertificate.subject.attributes
      );

      /*
       * ======================================================
       * Creiamo il PayloadContent finale.
       * ======================================================
       */

      const finalPayloads =
        createFinalPayloads();

      console.log(
        "Final payload count:",
        finalPayloads.length
      );

      /*
       * ======================================================
       * Array plist → XML plist
       * ======================================================
       */

      const serializedPayloads =
        serializeFinalPayloads(
          finalPayloads
        );

      console.log(
        "Final PayloadContent size:",
        serializedPayloads.length
      );

      /*
       * ======================================================
       * Cifriamo il PayloadContent con la chiave pubblica
       * del certificato SCEP del dispositivo.
       * ======================================================
       */

      const encryptedPayload =
        encryptFinalPayload(
          serializedPayloads,
          deviceCertificate
        );

      console.log(
        "EncryptedPayloadContent size:",
        encryptedPayload.byteLength
      );

      /*
       * ======================================================
       * Creiamo il configuration profile finale.
       * ======================================================
       */

      const finalConfiguration =
        createFinalConfigurationProfile(
          encryptedPayload
        );

      console.log(
        "=== FINAL CONFIGURATION PROFILE ==="
      );

      console.log(
        finalConfiguration
      );

      console.log(
        "=== END FINAL CONFIGURATION PROFILE ==="
      );

      /*
       * ======================================================
       * Firmiamo il profilo finale con il certificato
       * del Profile Service.
       * ======================================================
       */

      const signedFinalConfiguration =
        await signConfigurationProfile(
          finalConfiguration
        );

      console.log(
        "Signed final configuration size:",
        signedFinalConfiguration.byteLength
      );

      /*
       * ======================================================
       * Restituiamo il profilo finale a iOS.
       * ======================================================
       */

      const responseBuffer =
        new ArrayBuffer(
          signedFinalConfiguration.byteLength
        );

      new Uint8Array(
        responseBuffer
      ).set(
        signedFinalConfiguration
      );

      console.log(
        "Returning FINAL encrypted profile to device..."
      );

      return new NextResponse(
        responseBuffer,
        {
          status: 200,

          headers: {
            "Content-Type":
              "application/x-apple-aspen-config",

            "Content-Length":
              signedFinalConfiguration.byteLength.toString(),

            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    /*
     * ========================================================
     * PRIMO CALLBACK
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
     * Controlliamo se l'UDID è già registrato.
     *
     * Se è dello stesso account, NON lo aggiorniamo.
     * Continuiamo semplicemente.
     *
     * Se appartiene a un altro account, 409.
     * ========================================================
     */

    const existingDevice =
      await db.orm.public.Device
        .where({
          udid,
        })
        .first();

    if (existingDevice) {
      if (
        existingDevice.userId !==
        registration.userId
      ) {
        console.error(
          "UDID already registered to another account:",
          udid
        );

        await db.orm.public.DeviceRegistration
          .where({
            id: registration.id,
          })
          .delete();

        return new NextResponse(
  "Dispositivo già registrato.",
  {
    status: 409,
  }
);
      }

      console.log(
        "Device already registered to this account:",
        udid
      );

      /*
       * NON aggiorniamo il record.
       *
       * Il dispositivo è già corretto.
       * Continuiamo con il profilo SCEP.
       */
    } else {
      /*
       * ======================================================
       * Nuovo dispositivo.
       * ======================================================
       */

      const product = response.attributes.product?.trim();
const version = response.attributes.version?.trim();

if (!product || !version) {
  console.error("Device attributes incomplete:", {
    product,
    version,
  });

  return NextResponse.json(
    { error: "Informazioni del dispositivo incomplete." },
    { status: 400 }
  );
}

await db.orm.public.Device.create({
  userId: registration.userId,
  udid,
  product,
  build: version,
});

      console.log(
        "Device registered successfully:",
        udid
      );
    }

    /*
     * ========================================================
     * Creiamo il configuration profile SCEP.
     * ========================================================
     */

    const configuration =
      createConfigurationProfile(
        challenge
      );

    console.log(
      "=== CONFIGURATION PROFILE ==="
    );

    console.log(
      configuration
    );

    console.log(
      "=== END CONFIGURATION PROFILE ==="
    );

    /*
     * ========================================================
     * SCEP URL
     * ========================================================
     */

    const scepUrl =
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/devices/scep`;

    console.log(
      "SCEP URL:",
      scepUrl
    );

    console.log(
      "Returning signed configuration to device..."
    );

    /*
     * ========================================================
     * Firmiamo il configuration profile SCEP.
     * ========================================================
     */

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
     * Challenge one-time.
     *
     * Dopo aver consegnato il profilo SCEP, eliminiamo
     * la registrazione temporanea.
     * ========================================================
     */

    await db.orm.public.DeviceRegistration
      .where({
        id: registration.id,
      })
      .delete();

    /*
     * ========================================================
     * Restituiamo il CMS / PKCS#7 a iOS.
     * ========================================================
     */

    const responseBuffer =
      new ArrayBuffer(
        signedConfiguration.byteLength
      );

    new Uint8Array(
      responseBuffer
    ).set(
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