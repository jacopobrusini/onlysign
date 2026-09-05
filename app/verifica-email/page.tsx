"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";

type Status = "loading" | "success" | "error";

export default function VerificaEmailPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verifyEmail = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");

      if (!token) {
        setStatus("error");
        setMessage("Token di verifica mancante.");
        return;
      }

      try {
        const response = await fetch(
          `/api/auth/verify-email?token=${encodeURIComponent(token)}`
        );

        const data = await response.json();

        if (!response.ok) {
          setStatus("error");
          setMessage(
            data.error || "Impossibile verificare l'indirizzo email."
          );
          return;
        }

        setStatus("success");
        setMessage(data.message || "Email verificata con successo.");
      } catch {
        setStatus("error");
        setMessage(
          "Si è verificato un errore durante la verifica dell'email."
        );
      }
    };

    verifyEmail();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white">
      <Header />

      <div className="flex min-h-screen items-center justify-center px-6 pt-16">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
          {status === "loading" && (
            <>
              <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-white" />

              <h1 className="text-2xl font-semibold">
                Verifica in corso
              </h1>

              <p className="mt-3 text-sm leading-6 text-white/50">
                Stiamo verificando il tuo indirizzo email...
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 text-2xl text-green-400">
                ✓
              </div>

              <h1 className="mt-6 text-2xl font-semibold">
                Email verificata
              </h1>

              <p className="mt-3 text-sm leading-6 text-white/50">
                {message}
              </p>

              <Link
                href="/login"
                className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200"
              >
                Vai al login
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-2xl text-red-400">
                ×
              </div>

              <h1 className="mt-6 text-2xl font-semibold">
                Verifica non riuscita
              </h1>

              <p className="mt-3 text-sm leading-6 text-white/50">
                {message}
              </p>

              <div className="mt-8 flex flex-col gap-3">
                <Link
                  href="/registrazione"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200"
                >
                  Torna alla registrazione
                </Link>

                <Link
                  href="/"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-medium text-white transition hover:bg-white/10"
                >
                  Torna alla Home
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}