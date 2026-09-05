"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (!email.trim()) {
      setError("Inserisci la tua email.");
      return;
    }

    if (!password) {
      setError("Inserisci la tua password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error || "Email o password non corrette."
        );
        return;
      }

      router.push("/dashboard");
    } catch {
      setError(
        "Si è verificato un errore durante il login."
      );
    } finally {
      setLoading(false);
    }
  }

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
              Accedi a onlySign
            </h1>

            <p className="mt-3 text-zinc-400">
              Accedi al tuo account per continuare.
            </p>
          </div>

          {/* Pannello */}
          <div className="rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl">
            <form
              className="space-y-5"
              onSubmit={handleSubmit}
            >
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
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="nome@email.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-white/40 focus:bg-black/30"
                />
              </div>

              {/* Password */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-zinc-200"
                  >
                    Password
                  </label>

                  <Link
                    href="/recupera-password"
                    className="text-xs text-zinc-400 transition hover:text-white"
                  >
                    Password dimenticata?
                  </Link>
                </div>

                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="La tua password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-white/40 focus:bg-black/30"
                />
              </div>

              {/* Errore */}
              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {/* Login */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-white py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Accesso in corso..." : "Accedi"}
              </button>
            </form>

            {/* Registrazione */}
            <div className="mt-6 border-t border-white/10 pt-6 text-center">
              <p className="text-sm text-zinc-400">
                Non hai ancora un account?
              </p>

              <Link
                href="/registrazione"
                className="mt-2 inline-block text-sm font-medium text-white transition hover:text-zinc-300"
              >
                Crea un account
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}