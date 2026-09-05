import Link from "next/link";
import Header from "@/components/Header";

export default function Dashboard() {
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
              Bentornato, Jacopo
            </h1>

            <p className="mt-3 text-white/60">
              Gestisci i tuoi dispositivi, token e certificati.
            </p>
          </div>

          {/* Token */}
          <div className="grid gap-4 sm:grid-cols-3">

            <Link
              href="/prezzi"
              className="block rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur-xl transition hover:bg-white/5"
            >
              <p className="text-sm text-white/50">
                Token disponibili
              </p>

              <p className="mt-2 text-4xl font-bold">
                10
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

            <div className="mt-6 space-y-3">

              {/* iPhone 15 Pro */}
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex min-w-0 items-center gap-4">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/30 text-xl">
                    📱
                  </div>

                  <div className="min-w-0">
                    <p className="font-medium">
                      iPhone 15 Pro
                    </p>

                    <p className="mt-1 text-xs text-white/40">
                      iOS 18.6 · UDID: A1B2C3D4-...-7890AB
                    </p>
                  </div>
                </div>

                <div className="ml-4 flex shrink-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />

                  <span className="hidden text-xs text-emerald-300 sm:inline">
                    Certificato pronto
                  </span>
                </div>
              </div>

              {/* iPhone 13 */}
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex min-w-0 items-center gap-4">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/30 text-xl">
                    📱
                  </div>

                  <div className="min-w-0">
                    <p className="font-medium">
                      iPhone 13
                    </p>

                    <p className="mt-1 text-xs text-white/40">
                      iOS 18.5 · UDID: B2C3D4E5-...-8901AB
                    </p>
                  </div>
                </div>

                <div className="ml-4 flex shrink-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />

                  <span className="hidden text-xs text-red-300 sm:inline">
                    Acquista certificato
                  </span>
                </div>
              </div>

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