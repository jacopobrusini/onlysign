import Link from "next/link";
import Header from "@/components/Header";

export default function AggiungiDispositivoPage() {
  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <Header />

      <section className="flex min-h-screen items-center justify-center px-6 pt-16">
        <div className="w-full max-w-md">
          {/* Titolo */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight">
              Aggiungi dispositivo
            </h1>

            <p className="mt-3 text-zinc-400">
              Installa il profilo onlySign sul dispositivo che vuoi registrare.
            </p>
          </div>

          {/* Pannello */}
          <div className="rounded-3xl border border-white/20 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-2xl">

            {/* Icona */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-black/30 text-3xl">
              📱
            </div>

            <h2 className="mt-6 text-xl font-semibold">
              Installa il profilo
            </h2>

            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-zinc-400">
              Per registrare il tuo dispositivo, installa il profilo di
              configurazione onlySign. Il dispositivo verrà riconosciuto
              automaticamente.
            </p>

            {/* Installa profilo */}
            <button
              type="button"
              className="mt-7 w-full rounded-xl bg-white py-3 font-medium text-black transition hover:bg-zinc-200"
            >
              Installa profilo
            </button>

            {/* Torna indietro */}
            <div className="mt-6 border-t border-white/10 pt-6">
              <Link
                href="/dashboard/dispositivi"
                className="text-sm font-medium text-white transition hover:text-zinc-300"
              >
                ← Torna ai dispositivi
              </Link>
            </div>

          </div>
        </div>
      </section>
    </main>
  );
}