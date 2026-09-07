import { NextResponse } from "next/server";
import forge from "node-forge";

export const runtime = "nodejs";

/*
 * ============================================================
 * SCEP configuration
 * ============================================================
 */

const CA_CERT_BASE64 =
  process.env.ONLYSIGN_CA_CERT_BASE64;

const CA_KEY_BASE64 =
  process.env.ONLYSIGN_CA_KEY_BASE64;

/*
 * ============================================================
 * Helpers
 * ============================================================
 */

function getBase64Env(
  value: string | undefined,
  name: string
): string {
  if (!value) {
    throw new Error(
      `${name} non configurata.`
    );
  }

  return value.trim();
}

/*
 * ============================================================
 * Carica il certificato CA.
 *
 * La variabile d'ambiente contiene il file
 * onlysign-ca.crt codificato in Base64.
 *
 * Supportiamo sia:
 *
 * - Base64 di PEM
 * - Base64 di DER
 * ============================================================
 */

function loadCaCertificate() {
  const caCertBase64 =
    getBase64Env(
      CA_CERT_BASE64,
      "ONLYSIGN_CA_CERT_BASE64"
    );

  /*
   * Base64 → binary
   */
  const binary =
    forge.util.decode64(
      caCertBase64
    );

  /*
   * Proviamo prima come PEM.
   */
  const text =
    forge.util.decodeUtf8(
      binary
    );

  if (
    text.includes(
      "-----BEGIN CERTIFICATE-----"
    )
  ) {
    return forge.pki.certificateFromPem(
      text
    );
  }

  /*
   * Altrimenti consideriamo il contenuto
   * come DER.
   */
  const asn1 =
    forge.asn1.fromDer(
      binary
    );

  return forge.pki.certificateFromAsn1(
    asn1
  );
}

/*
 * ============================================================
 * GET /api/devices/scep
 *
 * SCEP utilizza:
 *
 * operation=GetCACaps
 * operation=GetCACert
 *
 * ============================================================
 */

export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(request.url);

    const operation =
      url.searchParams.get(
        "operation"
      );

    console.log(
      "=== SCEP GET ==="
    );

    console.log(
      "Operation:",
      operation
    );

    /*
     * ========================================================
     * GetCACaps
     * ========================================================
     *
     * Comunichiamo al dispositivo
     * quali funzionalità SCEP supportiamo.
     */

    if (
      operation ===
      "GetCACaps"
    ) {
      console.log(
        "SCEP GetCACaps"
      );

      const capabilities =
        [
          "POSTPKIOperation",
          "SHA-256",
          "AES",
        ].join("\r\n") +
        "\r\n";

      return new NextResponse(
        capabilities,
        {
          status: 200,

          headers: {
            "Content-Type":
              "text/plain",

            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    /*
     * ========================================================
     * GetCACert
     * ========================================================
     *
     * Restituiamo il certificato pubblico
     * della nostra CA.
     */

    if (
      operation ===
      "GetCACert"
    ) {
      console.log(
        "SCEP GetCACert"
      );

      /*
       * ------------------------------------------------------
       * Carichiamo il certificato CA.
       * ------------------------------------------------------
       */

      const caCertificate =
        loadCaCertificate();

      /*
       * ------------------------------------------------------
       * Debug certificato.
       * ------------------------------------------------------
       */

      console.log(
        "SCEP CA subject:",
        caCertificate.subject.attributes
      );

      console.log(
        "SCEP CA issuer:",
        caCertificate.issuer.attributes
      );

      console.log(
        "SCEP CA serial:",
        caCertificate.serialNumber
      );

      /*
       * ------------------------------------------------------
       * X.509 → ASN.1 → DER
       * ------------------------------------------------------
       *
       * Ricostruiamo il DER direttamente dal
       * certificato X.509, invece di restituire
       * semplicemente il contenuto della variabile.
       * ------------------------------------------------------
       */

      const caAsn1 =
        forge.pki.certificateToAsn1(
          caCertificate
        );

      const caDer =
        forge.asn1
          .toDer(
            caAsn1
          )
          .getBytes();

      /*
       * ------------------------------------------------------
       * DER → Uint8Array
       * ------------------------------------------------------
       */

      const caBytes =
        new Uint8Array(
          caDer.length
        );

      for (
        let i = 0;
        i < caDer.length;
        i++
      ) {
        caBytes[i] =
          caDer.charCodeAt(i) &
          0xff;
      }

      console.log(
        "CA certificate size:",
        caBytes.byteLength
      );

      /*
       * ------------------------------------------------------
       * Risposta SCEP GetCACert.
       * ------------------------------------------------------
       */

      return new NextResponse(
        caBytes,
        {
          status: 200,

          headers: {
            "Content-Type":
              "application/x-x509-ca-cert",

            "Content-Length":
              caBytes.byteLength.toString(),

            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    /*
     * ========================================================
     * Operazione SCEP non supportata.
     * ========================================================
     */

    return new NextResponse(
      "SCEP operation not supported.",
      {
        status: 400,
      }
    );

  } catch (error) {
    console.error(
      "SCEP GET error:",
      error
    );

    return new NextResponse(
      "SCEP server error.",
      {
        status: 500,
      }
    );
  }
}

/*
 * ============================================================
 * POST /api/devices/scep
 *
 * PKIOperation verrà implementato
 * nel prossimo step.
 * ============================================================
 */

export async function POST(
  request: Request
) {
  try {
    const url =
      new URL(request.url);

    const operation =
      url.searchParams.get(
        "operation"
      );

    console.log(
      "=== SCEP POST ==="
    );

    console.log(
      "Operation:",
      operation
    );

    const body =
      await request.arrayBuffer();

    console.log(
      "Request size:",
      body.byteLength
    );

    if (
      body.byteLength === 0
    ) {
      return new NextResponse(
        "Empty SCEP request.",
        {
          status: 400,
        }
      );
    }

    /*
     * --------------------------------------------------------
     * PKIOperation
     * --------------------------------------------------------
     *
     * NON implementato ancora.
     */

    if (
      operation ===
      "PKIOperation"
    ) {
      console.log(
        "=== SCEP PKIOperation ==="
      );

      console.log(
        "PKIOperation payload size:",
        body.byteLength
      );

      return new NextResponse(
        "PKIOperation not implemented yet.",
        {
          status: 501,
        }
      );
    }

    return new NextResponse(
      "SCEP operation not supported.",
      {
        status: 400,
      }
    );

  } catch (error) {
    console.error(
      "SCEP POST error:",
      error
    );

    return new NextResponse(
      "SCEP server error.",
      {
        status: 500,
      }
    );
  }
}