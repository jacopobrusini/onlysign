import { db } from "@/prisma/db";

type IPSWDeviceResponse = {
  identifier?: string;
  name?: string;
};

export async function getDeviceModel(product: string) {
  const normalizedProduct = product.trim();

  if (!normalizedProduct) {
    return "Dispositivo Apple";
  }

  // Controlla la cache
  const cached = await db.orm.public.DeviceModelCache
    .where({
      product: normalizedProduct,
    })
    .first();

  if (cached?.model && cached.model !== "Dispositivo Apple") {
    return cached.model;
  }

  try {
    const response = await fetch(
      `https://api.ipsw.me/v4/device/${encodeURIComponent(
        normalizedProduct
      )}`,
      {
        next: {
          revalidate: 86400,
        },
      }
    );

    if (!response.ok) {
      console.error(
        "IPSW Downloads device request failed:",
        response.status,
        response.statusText
      );

      return "Dispositivo Apple";
    }

    const data =
      (await response.json()) as IPSWDeviceResponse;

    const model = data.name?.trim();

    if (!model) {
      console.error(
        "IPSW Downloads device name not found:",
        normalizedProduct
      );

      return "Dispositivo Apple";
    }

    // Aggiorna la cache
    await db.orm.public.DeviceModelCache.upsert({
      where: {
        product: normalizedProduct,
      },
      update: {
        model,
      },
      create: {
        product: normalizedProduct,
        model,
        build: "",
        version: "",
      },
    });

    return model;
  } catch (error) {
    console.error(
      "IPSW Downloads device lookup error:",
      error
    );

    return "Dispositivo Apple";
  }
}