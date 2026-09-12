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

function formatValidity(days: number) {
if (days >= 330) {
return "1 anno";
}

if (days === 365) {
return "1 anno";
}

return `${days} giorni`;
}

function formatAntiRevoke(days: number | null) {
if (days === null) {
return "Nessuna garanzia";
}

switch (days) {
case 30:
return "1 mese";
case 90:
return "3 mesi";
case 180:
return "6 mesi";
case 330:
return "1 anno";
default:
return `${days} giorni`;
}
}

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

const [deviceName, iosVersion, certificateTypes] =
await Promise.all([
getDeviceModel(device.product),
getIOSVersion(device.product, device.build),
db.orm.public.CertificateType
.where({
active: true,
})
.all(),
]);

const certificates = [...certificateTypes].sort(
(a, b) => a.tokens - b.tokens
);

return (
<main
className="min-h-screen bg-cover bg-center bg-fixed text-white"
style={{ backgroundImage: "url('/background.png')" }}
> <Header />

```
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
          Visualizza le informazioni del dispositivo e acquista un certificato.
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

      {/* Acquista certificato */}
      <div className="mt-8">
        <div className="mb-5">
          <h2 className="text-2xl font-semibold">
            Acquista certificato
          </h2>

          <p className="mt-2 text-sm text-white/60">
            Scegli il certificato da utilizzare su questo dispositivo.
          </p>
        </div>

        {certificates.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center shadow-xl backdrop-blur-xl">
            <p className="text-white/60">
              Nessun certificato disponibile al momento.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {certificates.map((certificate) => (
              <div
                key={certificate.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur-xl transition hover:border-white/20 hover:bg-black/25"
              >
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold">
                      {certificate.name}
                    </h3>

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/60">
                      <span>
                        Validità:{" "}
                        <span className="text-white/80">
                          {formatValidity(certificate.validityDays)}
                        </span>
                      </span>

                      {certificate.antiRevokeDays !== null && (
                        <span>
                          Anti-Revoke:{" "}
                          <span className="text-white/80">
                            {formatAntiRevoke(
                              certificate.antiRevokeDays
                            )}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-3 sm:items-end">
                    <div className="text-sm text-white/50">
                      {certificate.tokens}{" "}
                      {certificate.tokens === 1
                        ? "token"
                        : "token"}
                    </div>

                    <button
                      type="button"
                      disabled
                      className="rounded-xl bg-white/10 px-5 py-3 text-sm font-medium text-white/40"
                    >
                      Acquista certificato
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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