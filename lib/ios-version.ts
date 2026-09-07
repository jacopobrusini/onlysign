type IPSWFirmwareResponse = {
  identifier?: string;
  version?: string;
  buildid?: string;
};

export async function getIOSVersion(
  identifier: string,
  buildId: string
) {
  const normalizedIdentifier = identifier.trim();
  const normalizedBuildId = buildId.trim();

  if (!normalizedIdentifier || !normalizedBuildId) {
    return normalizedBuildId || "Versione iOS non disponibile";
  }

  try {
    const response = await fetch(
      `https://api.ipsw.me/v4/ipsw/${encodeURIComponent(
        normalizedIdentifier
      )}/${encodeURIComponent(normalizedBuildId)}`,
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
          identifier: normalizedIdentifier,
          buildId: normalizedBuildId,
        }
      );

      return normalizedBuildId;
    }

    const data =
      (await response.json()) as IPSWFirmwareResponse;

    const version = data.version?.trim();

    if (!version) {
      console.error(
        "IPSW Downloads iOS version not found:",
        {
          identifier: normalizedIdentifier,
          buildId: normalizedBuildId,
        }
      );

      return normalizedBuildId;
    }

    return version;
  } catch (error) {
    console.error(
      "IPSW Downloads iOS version lookup error:",
      error
    );

    return normalizedBuildId;
  }
}