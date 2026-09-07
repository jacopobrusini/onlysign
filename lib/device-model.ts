type IPSWDeviceResponse = {
  identifier?: string;
  name?: string;
};

export async function getDeviceModel(identifier: string) {
  const normalizedIdentifier = identifier.trim();

  if (!normalizedIdentifier) {
    return "Dispositivo Apple";
  }

  try {
    const response = await fetch(
      `https://api.ipsw.me/v4/device/${encodeURIComponent(
        normalizedIdentifier
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
        normalizedIdentifier
      );

      return "Dispositivo Apple";
    }

    return model;
  } catch (error) {
    console.error(
      "IPSW Downloads device lookup error:",
      error
    );

    return "Dispositivo Apple";
  }
}