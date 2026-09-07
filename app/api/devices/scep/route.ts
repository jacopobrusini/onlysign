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

function base64ToBytes(
  value: string
): string {
  return forge.util.decode64(value);
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
     * --------------------------------------------------------
     * GetCACaps
     * --------------------------------------------------------
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
     * --------------------------------------------------------
     * GetCACert
     * --------------------------------------------------------
     *
     * Restituiamo il certificato
     * pubblico della nostra CA.
     */

    if (
      operation ===
      "GetCACert"
    ) {
      console.log(
        "SCEP GetCACert"
      );

      const caCertBase64 =
        getBase64Env(
          CA_CERT_BASE64,
          "ONLYSIGN_CA_CERT_BASE64"
        );

      const caCertDer =
        base64ToBytes(
          caCertBase64
        );

      const caCertBuffer =
        new Uint8Array(
          caCertDer.length
        );

      for (
        let i = 0;
        i < caCertDer.length;
        i++
      ) {
        caCertBuffer[i] =
          caCertDer.charCodeAt(i) &
          0xff;
      }

      return new NextResponse(
        caCertBuffer,
        {
          status: 200,

          headers: {
            "Content-Type":
              "application/x-x509-ca-cert",

            "Content-Length":
              caCertBuffer.byteLength.toString(),

            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    /*
     * --------------------------------------------------------
     * Operazione SCEP non supportata.
     * --------------------------------------------------------
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
 * Qui arriverà PKIOperation.
 *
 * Per ora registriamo la richiesta e
 * restituiamo un errore esplicito.
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
     */

    if (
      operation ===
      "PKIOperation"
    ) {
      console.log(
        "=== SCEP PKIOperation ==="
      );

      /*
       * DEBUG:
       * mostriamo soltanto la dimensione.
       *
       * NON stampiamo il contenuto
       * PKCS#7 nei log.
       */

      console.log(
        "PKIOperation payload size:",
        body.byteLength
      );

      /*
       * TODO:
       *
       * 1. Parse PKCS#7
       * 2. Decrypt envelopedData
       * 3. Extract CSR
       * 4. Verify SCEP challenge
       * 5. Issue device certificate
       * 6. Build SCEP CertRep
       * 7. Return PKCS#7
       */

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