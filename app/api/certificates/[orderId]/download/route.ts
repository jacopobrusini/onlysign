import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getSession } from "@/lib/session";

const PPQCHECK_API_BASE =
  "https://br.api-developer.dev/v1/integration";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

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
  };
  timestamp?: string;
  path?: string;
};

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        {
          error: "Non autenticato",
        },
        {
          status: 401,
        }
      );
    }

    const { orderId } = await params;
    const certificateOrderId = Number(orderId);

    if (!Number.isInteger(certificateOrderId)) {
      return NextResponse.json(
        {
          error: "ID ordine non valido",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Recuperiamo l'ordine assicurandoci che appartenga
     * all'utente autenticato.
     */
    const order = await db.orm.public.CertificateOrder
      .where({
        id: certificateOrderId,
        userId: session.user.id,
      })
      .first();

    if (!order) {
      return NextResponse.json(
        {
          error: "Ordine non trovato",
        },
        {
          status: 404,
        }
      );
    }

    if (order.status !== "SUCCESS") {
      return NextResponse.json(
        {
          error: "Il certificato non è ancora disponibile",
        },
        {
          status: 409,
        }
      );
    }

    if (!order.ppqcheckOrderId) {
      return NextResponse.json(
        {
          error: "Ordine PPQCheck non disponibile",
        },
        {
          status: 500,
        }
      );
    }

    const apiKey = process.env.PPQCHECK_API_KEY;

    if (!apiKey) {
      console.error(
        "PPQCheck download: PPQCHECK_API_KEY mancante"
      );

      return NextResponse.json(
        {
          error: "Configurazione PPQCheck mancante",
        },
        {
          status: 500,
        }
      );
    }

    const ppqcheckUrl =
      `${PPQCHECK_API_BASE}/certificate?id=` +
      encodeURIComponent(order.ppqcheckOrderId);

    const response = await fetch(ppqcheckUrl, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const rawResponse = await response.text();

    console.log(
      "PPQCheck RAW DOWNLOAD RESPONSE:",
      rawResponse
    );

    let ppqcheckResponse: PpqcheckCertificateResponse;

    try {
      ppqcheckResponse =
        JSON.parse(rawResponse) as PpqcheckCertificateResponse;
    } catch (error) {
      console.error(
        "PPQCheck download: risposta JSON non valida",
        error
      );

      return NextResponse.json(
        {
          error: "Risposta non valida da PPQCheck",
        },
        {
          status: 502,
        }
      );
    }

    if (!response.ok) {
      console.error(
        "PPQCheck download HTTP error:",
        response.status,
        ppqcheckResponse
      );

      return NextResponse.json(
        {
          error:
            ppqcheckResponse.message ||
            "Impossibile recuperare il certificato da PPQCheck",
        },
        {
          status: 502,
        }
      );
    }

    const certificate = ppqcheckResponse.data;

    if (!certificate) {
      return NextResponse.json(
        {
          error: "Dati certificato mancanti",
        },
        {
          status: 502,
        }
      );
    }

    if (certificate.status !== "success") {
      return NextResponse.json(
        {
          error: "Il certificato PPQCheck non è ancora pronto",
          status: certificate.status ?? null,
        },
        {
          status: 409,
        }
      );
    }

    if (certificate.certificateRevoked) {
      return NextResponse.json(
        {
          error: "Il certificato è stato revocato",
        },
        {
          status: 410,
        }
      );
    }

    if (!certificate.zip) {
      console.error(
        "PPQCheck download: ZIP mancante",
        certificate.zipError
      );

      return NextResponse.json(
        {
          error:
            certificate.zipError ||
            "File del certificato non disponibile",
        },
        {
          status: 502,
        }
      );
    }

    /*
     * PPQCheck restituisce il certificato come Base64.
     * Lo convertiamo direttamente in bytes e lo restituiamo
     * come file ZIP.
     */
    let zipBuffer: Buffer;

    try {
      zipBuffer = Buffer.from(
        certificate.zip,
        "base64"
      );
    } catch (error) {
      console.error(
        "PPQCheck download: errore decodifica ZIP",
        error
      );

      return NextResponse.json(
        {
          error: "Impossibile decodificare il certificato",
        },
        {
          status: 502,
        }
      );
    }

    if (zipBuffer.length === 0) {
      return NextResponse.json(
        {
          error: "Il file ZIP è vuoto",
        },
        {
          status: 502,
        }
      );
    }

    const filename =
      certificate.filename ||
      `certificate-${order.id}.zip`;

    /*
     * Sanitizziamo il nome restituito da PPQCheck per evitare
     * caratteri problematici nell'header Content-Disposition.
     */
    const safeFilename = filename
      .replace(/[\r\n"]/g, "")
      .replace(/[^\x20-\x7E]/g, "_");

    const zipBytes = new Uint8Array(zipBuffer);

return new NextResponse(zipBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(zipBuffer.length),
        "Content-Disposition":
          `attachment; filename="${safeFilename}"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error(
      "Certificate download error:",
      error
    );

    return NextResponse.json(
      {
        error: "Errore interno durante il download del certificato",
      },
      {
        status: 500,
      }
    );
  }
}