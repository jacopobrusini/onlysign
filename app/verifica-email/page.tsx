"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";

type Status = "checking" | "pending" | "loading" | "success" | "error";

export default function VerificaEmailPage() {
  const router = useRouter();

  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  const verificationStarted = useRef(false);

  useEffect(() => {
    if (verificationStarted.current) {
      return;
    }

    verificationStarted.current = true;

    const verifyEmail = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const emailParam = params.get("email");

      if (!token) {
        if (emailParam) {
          setEmail(emailParam);
          setStatus("pending");
          return;
        }

        setStatus("error");
        setMessage("Informazioni di verifica mancanti.");
        return;
      }

      setStatus("loading");

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

        setTimeout(() => {
          router.replace("/dashboard");
        }, 1200);
      } catch {
        setStatus("error");
        setMessage(
          "Si è verificato un errore durante la verifica dell'email."
        );
      }
    };

    verifyEmail();
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-white">
      <Header />

      <div className="flex min-h-screen items-center justify-center px-6 pt-16">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
          {status === "checking" && (
            <>
              <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-white" />

              <h1 className="text-2xl font-semibold">
                Caricamento
              </h1>

              <p className="mt-3 text-sm leading-6 text-white/50">
                Stiamo preparando la verifica del tuo account...
              </p>
            </>
          )}

          {status === "pending" && (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-2xl">
                ✉
              </div>

              <h1 className="mt-6 text-2xl font-semibold">
                Controlla la tua email
              </h1>

              <p className="mt-3 text-sm leading-6 text-white/50">
                Ti abbiamo inviato un&apos;email con il link per verificare
                il tuo account.
              </p>

              {email && (
                <p className="mt-4 break-all text-sm font-medium text-white/80">
                  {email}
                </p>
              )}

              <p className="mt-4 text-sm leading-6 text-white/40">
                Controlla la tua casella di posta e clicca sul link
                nell&apos;email per completare la verifica.
              </p>

              <div className="mt-8 flex flex-col gap-3">
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200"
                >
                  Vai al login
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

              <p className="mt-4 text-sm text-white/30">
                Ti stiamo reindirizzando alla dashboard...
              </p>
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