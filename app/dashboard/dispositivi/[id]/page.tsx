import DeleteDeviceButton from "./DeleteDeviceButton";
import Link from "next/link";
import Header from "@/components/Header";
import { getSession } from "@/lib/session";
import { getDeviceModel } from "@/lib/device-model";
import { getIOSVersion } from "@/lib/ios-version";
import { db } from "@/prisma/db";

type DevicePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DevicePage({
  params,
}: DevicePageProps) {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const { id } = await params;
  const deviceId = Number(id);

  if (!Number.isInteger(deviceId)) {
    return null;
  }

  const device = await db.orm.public.Device
    .where({
      id: deviceId,
      userId: session.user.id,
    })
    .first();

  if (!device) {
    return null;
  }

  const [deviceName, iosVersion] = await Promise.all([
    getDeviceModel(device.product),
    getIOSVersion(device.product, device.build),
  ]);

  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <Header />

      <section className="px-6 pb-16 pt-28">
        <div className="mx-auto max-w-4xl">
          {/* Titolo */}
          <div className="mb-10">
            <p className="mb-2 text-sm uppercase tracking-[0.3em] text-white/60">
              Dispositivo
            </p>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              {deviceName}
            </h1>

            <p className="mt-3 text-white/60">
              Visualizza le informazioni del dispositivo.
            </p>
          </div>

          {/* Informazioni dispositivo */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur-xl">
            <h2 className="text-xl font-semibold">
              Informazioni dispositivo
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {/* Modello */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                  Modello
                </p>

                <p className="mt-2 text-white">
                  {deviceName}
                </p>
              </div>

              {/* iOS */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                  Versione iOS
                </p>

                <p className="mt-2 text-white">
                  {iosVersion
                    ? `iOS ${iosVersion}`
                    : "Non disponibile"}
                </p>
              </div>

              {/* UDID */}
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                  UDID
                </p>

                <p className="mt-2 break-all font-mono text-sm text-white/70">
                  {device.udid}
                </p>
              </div>
            </div>
          </div>

          <DeleteDeviceButton deviceId={device.id} />

          {/* Torna ai dispositivi */}
          <div className="mt-8 text-center">
            <Link
              href="/dashboard/dispositivi"
              className="text-sm font-medium text-white/60 transition hover:text-white"
            >
              ← Torna ai dispositivi
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}