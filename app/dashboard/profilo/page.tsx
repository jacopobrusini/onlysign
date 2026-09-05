import Link from "next/link";
import Header from "@/components/Header";

export default function Profilo() {
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
              Il tuo profilo
            </h1>

            <p className="mt-3 text-white/60">
              Gestisci le informazioni del tuo account.
            </p>
          </div>

          {/* Informazioni account */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur-xl">

            <h2 className="text-xl font-semibold">
              Informazioni account
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">

              {/* Username */}
              <div>
                <label className="mb-2 block text-sm text-white/50">
                  Username
                </label>

                <input
                  type="text"
                  defaultValue="Jacopo"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-white/30 focus:bg-white/10"
                />
              </div>

              {/* Email */}
              <div>
                <label className="mb-2 block text-sm text-white/50">
                  Email
                </label>

                <input
                  type="email"
                  defaultValue="jacopo@example.com"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-white/30 focus:bg-white/10"
                />
              </div>

            </div>

            <button
              type="button"
              className="mt-6 rounded-xl bg-white px-6 py-3 font-medium text-black transition hover:bg-zinc-200"
            >
              Salva modifiche
            </button>

          </div>

          {/* Password */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur-xl">

            <h2 className="text-xl font-semibold">
              Password
            </h2>

            <p className="mt-2 text-sm text-white/50">
              Cambia la password del tuo account.
            </p>

            <Link
              href="/dashboard/profilo/password"
              className="mt-5 inline-block rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-medium text-white transition hover:bg-white/10"
            >
              Cambia password
            </Link>

    
          </div>

          {/* Eliminazione account */}
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/5 p-6 shadow-xl backdrop-blur-xl">

            <h2 className="text-xl font-semibold text-red-200">
              Zona pericolosa
            </h2>

            <p className="mt-2 max-w-2xl text-sm text-white/50">
              L&apos;eliminazione dell&apos;account rimuoverà definitivamente
              i dati associati al tuo profilo.
            </p>

            <button
              type="button"
              className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 px-6 py-3 font-medium text-red-200 transition hover:bg-red-500/20"
            >
              Elimina account
            </button>

          </div>

        </div>
      </section>
    </main>
  );
}