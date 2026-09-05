import Link from "next/link";
import Header from "@/components/Header";

export default function RecuperaPasswordPage() {
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
              Recupera la tua password
            </h1>

            <p className="mt-3 text-zinc-400">
              Inserisci la tua email e ti invieremo un link per reimpostare
              la password.
            </p>
          </div>

          {/* Pannello */}
          <div className="rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl">
            <form className="space-y-5">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-zinc-200"
                >
                  Email
                </label>

                <input
                  id="email"
                  type="email"
                  placeholder="nome@email.com"
                  className="w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-white/40 focus:bg-black/30"
                />
              </div>

              {/* Recupero */}
              <button
                type="submit"
                className="w-full rounded-xl bg-white py-3 font-medium text-black transition hover:bg-zinc-200"
              >
                Invia link di recupero
              </button>
            </form>

            {/* Torna al login */}
            <div className="mt-6 border-t border-white/10 pt-6 text-center">
              <Link
                href="/login"
                className="text-sm font-medium text-white transition hover:text-zinc-300"
              >
                ← Torna al login
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}