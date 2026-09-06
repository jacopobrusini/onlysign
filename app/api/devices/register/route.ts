import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/prisma/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sessionData = await getSession();

    if (!sessionData) {
      return NextResponse.json(
        {
          error: "Devi effettuare l'accesso.",
        },
        { status: 401 }
      );
    }

    const { user } = sessionData;

    // Challenge casuale e non prevedibile.
    const challenge = randomBytes(32).toString("hex");

    // Nel database salviamo solamente l'hash.
    const tokenHash = createHash("sha256")
      .update(challenge)
      .digest("hex");

    // La registrazione rimane valida 10 minuti.
    const expiresAt = Temporal.Now.instant().add({
      minutes: 10,
    });

    await db.orm.public.DeviceRegistration.create({
      tokenHash,
      userId: user.id,
      expiresAt,
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";

    // Il challenge NON viene messo nell'URL.
    const callbackUrl =
      `${appUrl}/api/devices/callback`;

    const payloadUUID = randomUUID().toUpperCase();

    const mobileConfig = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <dict>
        <key>URL</key>
        <string>${callbackUrl}</string>

        <key>DeviceAttributes</key>
        <array>
            <string>UDID</string>
            <string>DEVICE_NAME</string>
            <string>VERSION</string>
            <string>PRODUCT</string>
        </array>

        <key>Challenge</key>
        <string>${challenge}</string>
    </dict>

    <key>PayloadOrganization</key>
    <string>onlySign</string>

    <key>PayloadDisplayName</key>
    <string>Registrazione dispositivo</string>

    <key>PayloadVersion</key>
    <integer>1</integer>

    <key>PayloadUUID</key>
    <string>${payloadUUID}</string>

    <key>PayloadIdentifier</key>
    <string>it.onlysign.profile-service</string>

    <key>PayloadDescription</key>
    <string>Profilo temporaneo per registrare questo dispositivo su onlySign.</string>

    <key>PayloadType</key>
    <string>Profile Service</string>
</dict>
</plist>`;

    return new NextResponse(mobileConfig, {
      status: 200,
      headers: {
        "Content-Type": "application/x-apple-aspen-config",
        "Content-Disposition":
          'attachment; filename="onlySign-device.mobileconfig"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Device registration error:", error);

    return NextResponse.json(
      {
        error:
          "Si è verificato un errore durante la registrazione del dispositivo.",
      },
      { status: 500 }
    );
  }
}