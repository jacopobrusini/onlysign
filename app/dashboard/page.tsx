import Link from "next/link";
import Header from "@/components/Header";
import { getSession } from "@/lib/session";
import { getDeviceModel } from "@/lib/device-model";
import { getIOSVersion } from "@/lib/ios-version";
import { db } from "@/prisma/db";

export default async function Dashboard() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const users = await db.orm.public.User
    .where({
      id: session.user.id,
    })
    .all();

  const user = users[0];

  if (!user) {
    return null;
  }

  const username = user.username;

  const devices = await db.orm.public.Device
    .where({
      userId: session.user.id,
    })
    .all();

  const devicesWithModels = await Promise.all(
    devices.map(async (device) => {
      const [model, iosVersion] = await Promise.all([
        getDeviceModel(device.product),
        getIOSVersion(device.product, device.build),
      ]);

      return {
        ...device,
        model,
        iosVersion,
      };
    })
  );

  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <Header />

      <section className="px-6 pb-16 pt-28">
        <div className="mx-auto max-w-6xl">
          {/* Titolo */}
          <div className="mb-10">
            <p className="mb-2 text-sm uppercase tracking-[0.3em] text-white/60">
              Dashboard
            </p>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Bentornato, {username}
            </h1>

            <p className="mt-3 text-white/60">
              Gestisci i tuoi dispositivi, token e certificati.
            </p>
          </div>

          {/* Token */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Link
              href="/dashboard/token"
              className="block rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur-xl transition hover:bg-white/5"
            >
              <p className="text-sm text-white/50">
                Token disponibili
              </p>

              <p className="mt-2 text-4xl font-bold">
                {user.tokenBalance}
              </p>

              <p className="mt-4 text-sm text-white/70">
                Acquista token →
              </p>
            </Link>
          </div>

          {/* Dispositivi */}
          <Link
            href="/dashboard/dispositivi"
            className="mt-8 block rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur-xl transition hover:bg-white/5"
          >
            <div>
              <h2 className="text-xl font-semibold">
                I tuoi dispositivi
              </h2>

              <p className="mt-1 text-sm text-white/50">
                I dispositivi associati al tuo account.
              </p>
            </div>

            {/* Elenco dispositivi */}
            <div className="mt-6 space-y-3">
              {devicesWithModels.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-black/30 text-2xl">
                    📱
                  </div>

                  <p className="mt-4 font-medium">
                    Nessun dispositivo registrato
                  </p>

                  <p className="mt-1 text-sm text-white/40">
                    Aggiungi un dispositivo per iniziare.
                  </p>
                </div>
              ) : (
                devicesWithModels.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/30 text-xl">
                        📱
                      </div>

                      <div className="min-w-0">
                        <p className="font-medium">
                          {device.model}
                        </p>

                        <p className="mt-1 truncate text-xs text-white/40">
                          {device.iosVersion
                            ? `iOS ${device.iosVersion}`
                            : "Versione iOS non disponibile"}
                          {" · "}
                          UDID: {device.udid}
                        </p>
                      </div>
                    </div>

                    <span className="ml-4 shrink-0 text-sm font-medium text-white/60">
                      →
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 text-right">
              <span className="text-sm font-medium text-white/60">
                Gestisci dispositivi →
              </span>
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}