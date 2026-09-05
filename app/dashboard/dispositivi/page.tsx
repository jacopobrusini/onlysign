import Link from "next/link";
import Header from "@/components/Header";

export default function DispositiviPage() {
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
        <div className="space-y-4">

          {/* Dispositivo 1 */}
          <Link
            href="/dashboard/dispositivi/1"
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
                      iPhone 15 Pro
                    </h2>

                    <p className="mt-1 text-sm text-zinc-400">
                      iOS 18.6
                    </p>
                  </div>

                </div>

                {/* UDID */}
                <div className="mt-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    UDID
                  </p>

                  <p className="mt-2 break-all font-mono text-sm text-zinc-300">
                    A1B2C3D4-E5F6-7890-ABCD-1234567890AB
                  </p>
                </div>
              </div>

              {/* Stato e gestione */}
              <div className="shrink-0 sm:text-right">

                <div className="flex items-center gap-2 sm:justify-end">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />

                  <span className="text-sm font-medium text-emerald-300">
                    Certificato pronto
                  </span>
                </div>

                <p className="mt-5 text-sm font-medium text-white/60">
                  Gestisci dispositivo →
                </p>

              </div>

            </div>
          </Link>

          {/* Dispositivo 2 */}
          <Link
            href="/dashboard/dispositivi/2"
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
                      iPhone 13
                    </h2>

                    <p className="mt-1 text-sm text-zinc-400">
                      iOS 18.5
                    </p>
                  </div>

                </div>

                {/* UDID */}
                <div className="mt-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    UDID
                  </p>

                  <p className="mt-2 break-all font-mono text-sm text-zinc-300">
                    B2C3D4E5-F6A7-8901-BCDE-2345678901AB
                  </p>
                </div>
              </div>

              {/* Stato e gestione */}
              <div className="shrink-0 sm:text-right">

                <div className="flex items-center gap-2 sm:justify-end">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />

                  <span className="text-sm font-medium text-red-300">
                    Acquista certificato
                  </span>
                </div>

                <p className="mt-5 text-sm font-medium text-white/60">
                  Gestisci dispositivo →
                </p>

              </div>

            </div>
          </Link>

        </div>

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