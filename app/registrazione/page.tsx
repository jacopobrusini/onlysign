import Link from "next/link";
import Header from "@/components/Header";

export default function RegistrationPage() {
  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <Header />

      <section className="flex min-h-screen items-center justify-center px-6 pb-10 pt-28">
        <div className="w-full max-w-md">
          {/* Titolo */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight">
              Crea il tuo account
            </h1>

            <p className="mt-3 text-zinc-400">
              Registrati per iniziare a usare onlySign.
            </p>
          </div>

          {/* Pannello */}
          <div className="rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl">
            <form className="space-y-5">
              {/* Username */}
              <div>
                <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-medium text-zinc-200"
                >
                  Username
                </label>

                <input
                  id="username"
                  type="text"
                  placeholder="Scegli un username"
                  className="w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-white/40 focus:bg-black/30"
                />
              </div>

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

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-zinc-200"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  placeholder="Scegli una password"
                  className="w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-white/40 focus:bg-black/30"
                />
              </div>

              {/* Conferma password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-medium text-zinc-200"
                >
                  Conferma password
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Ripeti la password"
                  className="w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-white/40 focus:bg-black/30"
                />
              </div>

              {/* Registrazione */}
              <button
                type="submit"
                className="w-full rounded-xl bg-white py-3 font-medium text-black transition hover:bg-zinc-200"
              >
                Crea account
              </button>
            </form>

            {/* Login */}
            <div className="mt-6 border-t border-white/10 pt-6 text-center">
              <p className="text-sm text-zinc-400">
                Hai già un account?
              </p>

              <Link
                href="/login"
                className="mt-2 inline-block text-sm font-medium text-white transition hover:text-zinc-300"
              >
                Accedi
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}