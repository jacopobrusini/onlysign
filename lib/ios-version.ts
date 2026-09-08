import { db } from "@/prisma/db";

type IPSWFirmwareResponse = {
  identifier?: string;
  version?: string;
  buildid?: string;
};

export async function getIOSVersion(
  product: string,
  build: string
) {
  const normalizedProduct = product.trim();
  const normalizedBuild = build.trim();

  if (!normalizedProduct || !normalizedBuild) {
    return "Versione iOS non disponibile";
  }

  // Controlla la cache
  const cached = await db.orm.public.DeviceModelCache
    .where({
      product: normalizedProduct,
    })
    .first();

  if (
    cached &&
    cached.build === normalizedBuild &&
    cached.version
  ) {
    return cached.version;
  }

  try {
    const response = await fetch(
      `https://api.ipsw.me/v4/ipsw/${encodeURIComponent(
        normalizedProduct
      )}/${encodeURIComponent(normalizedBuild)}`,
      {
        next: {
          revalidate: 86400,
        },
      }
    );

    if (!response.ok) {
      console.error(
        "IPSW Downloads iOS version request failed:",
        response.status,
        response.statusText,
        {
          product: normalizedProduct,
          build: normalizedBuild,
        }
      );

      return "Versione iOS non disponibile";
    }

    const data =
      (await response.json()) as IPSWFirmwareResponse;

    const version = data.version?.trim();

    if (!version) {
      console.error(
        "IPSW Downloads iOS version not found:",
        {
          product: normalizedProduct,
          build: normalizedBuild,
        }
      );

      return "Versione iOS non disponibile";
    }

    // Aggiorna la cache
    await db.orm.public.DeviceModelCache.upsert({
      conflictOn: {
        product: normalizedProduct,
      },
      update: {
        version,
        build: normalizedBuild,
      },
      create: {
        product: normalizedProduct,
        model: "Dispositivo Apple",
        version,
        build: normalizedBuild,
      },
    });

    return version;
  } catch (error) {
    console.error(
      "IPSW Downloads iOS version lookup error:",
      error
    );

    return "Versione iOS non disponibile";
  }
}