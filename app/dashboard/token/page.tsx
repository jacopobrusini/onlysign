import Link from "next/link";
import Header from "@/components/Header";

export default function TokenPage() {
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
              Account
            </p>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              I tuoi token
            </h1>

            <p className="mt-3 text-white/60">
              Gestisci i token disponibili sul tuo account.
            </p>
          </div>

          {/* Token disponibili */}
          <div className="text-center">

            <p className="text-5xl font-bold tracking-tight">
              10
            </p>

            <p className="mt-2 text-sm text-white/50">
              token disponibili
            </p>

            {/* Acquista token */}
            <Link
              href="/prezzi"
              className="mt-7 inline-block rounded-xl bg-white px-6 py-3 font-medium text-black transition hover:bg-zinc-200"
            >
              Acquista token
            </Link>

          </div>

          {/* Torna alla dashboard */}
          <div className="mt-12 text-center">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-white/60 transition hover:text-white"
            >
              ← Torna alla dashboard
            </Link>
          </div>

        </div>
      </section>
    </main>
  );
}