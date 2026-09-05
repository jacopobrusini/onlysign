import Link from "next/link";
import Header from "@/components/Header";

export default function PricesPage() {
  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <Header />

      <section className="min-h-screen px-6 pb-16 pt-32">
        <div className="mx-auto max-w-6xl">
          {/* Titolo */}
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Scegli i tuoi token
            </h1>

            <p className="mt-4 text-lg text-zinc-400">
              Acquista i token che ti servono e utilizzali quando vuoi.
            </p>

            <p className="mt-3 text-sm font-medium text-white">
              1 token = 1 certificato
            </p>
          </div>

          {/* Prezzi */}
          <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
            {/* 1 Token */}
            <div className="flex flex-col rounded-3xl border border-white/20 bg-white/10 p-7 shadow-2xl backdrop-blur-2xl">
              <div>
                <p className="text-sm font-medium text-zinc-400">
                  Singolo
                </p>

                <h2 className="mt-3 text-4xl font-bold">
                  €2
                </h2>

                <p className="mt-2 text-zinc-400">
                  1 token
                </p>
              </div>

              <div className="mt-8 flex-1">
                <p className="text-sm text-zinc-300">
                  Perfetto se ti serve un solo certificato.
                </p>
              </div>

              <Link
                href="/login"
                className="mt-8 rounded-xl bg-white py-3 text-center font-medium text-black transition hover:bg-zinc-200"
              >
                Acquista
              </Link>
            </div>

            {/* 5 Token */}
            <div className="relative flex flex-col rounded-3xl border border-white/30 bg-white/15 p-7 shadow-2xl backdrop-blur-2xl">
              <div className="absolute right-5 top-5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">
                Più scelto
              </div>

              <div>
                <p className="text-sm font-medium text-zinc-300">
                  Standard
                </p>

                <h2 className="mt-3 text-4xl font-bold">
                  €8
                </h2>

                <p className="mt-2 text-zinc-400">
                  5 token
                </p>
              </div>

              <div className="mt-8 flex-1">
                <p className="text-sm text-zinc-300">
                  Una soluzione conveniente per più dispositivi.
                </p>
              </div>

              <Link
                href="/login"
                className="mt-8 rounded-xl bg-white py-3 text-center font-medium text-black transition hover:bg-zinc-200"
              >
                Acquista
              </Link>
            </div>

            {/* 10 Token */}
            <div className="flex flex-col rounded-3xl border border-white/20 bg-white/10 p-7 shadow-2xl backdrop-blur-2xl">
              <div>
                <p className="text-sm font-medium text-zinc-400">
                  Pro
                </p>

                <h2 className="mt-3 text-4xl font-bold">
                  €10
                </h2>

                <p className="mt-2 text-zinc-400">
                  10 token
                </p>
              </div>

              <div className="mt-8 flex-1">
                <p className="text-sm text-zinc-300">
                  Il massimo risparmio per chi utilizza spesso il servizio.
                </p>
              </div>

              <Link
                href="/login"
                className="mt-8 rounded-xl bg-white py-3 text-center font-medium text-black transition hover:bg-zinc-200"
              >
                Acquista
              </Link>
            </div>
          </div>

          {/* Nota */}
          <div className="mx-auto mt-10 max-w-2xl text-center">
            <p className="text-sm text-zinc-500">
              I token acquistati vengono aggiunti al tuo account e possono
              essere utilizzati successivamente.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}