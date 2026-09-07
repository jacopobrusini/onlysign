import Link from "next/link";
import Header from "@/components/Header";
import { getSession } from "@/lib/session";
import { db } from "@/prisma/db";

export default async function DispositiviPage() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const devices = await db.orm.public.Device
    .where({
      userId: session.user.id,
    })
    .all();

  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <Header />

      <section className="mx-auto min-h-screen max-w-5xl px-6 pb-16 pt-32">

        {/* Intestazione */}
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              I tuoi dispositivi
            </h1>

            <p className="mt-3 text-zinc-400">
              Gestisci i dispositivi associati al tuo account.
            </p>
          </div>

          <Link
            href="/dashboard/dispositivi/aggiungi"
            className="w-full rounded-xl bg-white px-5 py-3 text-center text-sm font-medium text-black transition hover:bg-zinc-200 sm:w-auto"
          >
            + Aggiungi dispositivo
          </Link>
        </div>

        {/* Elenco dispositivi */}
        {devices.length === 0 ? (
          <div className="rounded-3xl border border-white/20 bg-white/10 p-10 text-center shadow-2xl backdrop-blur-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-black/30 text-3xl">
              📱
            </div>

            <h2 className="mt-5 text-xl font-semibold">
              Nessun dispositivo registrato
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
              Non hai ancora associato alcun dispositivo al tuo account.
            </p>

            <Link
              href="/dashboard/dispositivi/aggiungi"
              className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              Aggiungi dispositivo
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {devices.map((device) => (
              <Link
                key={device.id}
                href={`/dashboard/dispositivi/${device.id}`}
                className="block rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-2xl transition hover:bg-white/15"
              >
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">

                  {/* Informazioni dispositivo */}
                  <div className="min-w-0">
                    <div className="flex items-start gap-4">

                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black/30 text-2xl">
                        📱
                      </div>

                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold">
                          {device.product || "Dispositivo Apple"}
                        </h2>

                        <p className="mt-1 text-sm text-zinc-400">
                          {device.version
                            ? `iOS ${device.version}`
                            : "Versione iOS non disponibile"}
                        </p>
                      </div>

                    </div>

                    {/* UDID */}
                    <div className="mt-6">
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                        UDID
                      </p>

                      <p className="mt-2 break-all font-mono text-sm text-zinc-300">
                        {device.udid}
                      </p>
                    </div>
                  </div>

                  {/* Gestione */}
                  <div className="shrink-0 sm:text-right">
                    <p className="text-sm font-medium text-white/60">
                      Gestisci dispositivo →
                    </p>
                  </div>

                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Torna alla dashboard */}
        <div className="mt-8 text-center">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-white/60 transition hover:text-white"
          >
            ← Torna alla dashboard
          </Link>
        </div>

      </section>
    </main>
  );
}