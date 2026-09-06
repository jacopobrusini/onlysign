"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Status = "loading" | "success" | "error";

export default function ConfermaPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>(
    token ? "loading" : "error"
  );

  const [message, setMessage] = useState(
    token ? "" : "Token di conferma mancante."
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    const passwordToken = token;

    async function confirmPassword() {
      try {
        const response = await fetch(
          `/api/account/password/confirm?token=${encodeURIComponent(passwordToken)}`
        );

        const data = await response.json();

        if (!response.ok) {
          setStatus("error");
          setMessage(
            data.error ||
              "Impossibile confermare la modifica."
          );
          return;
        }

        setStatus("success");
        setMessage(
          "La password è stata modificata con successo."
        );
      } catch {
        setStatus("error");
        setMessage(
          "Si è verificato un errore di connessione."
        );
      }
    }

    confirmPassword();
  }, [token]);

  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-black/30 p-8 text-center shadow-2xl backdrop-blur-2xl">
          {status === "loading" && (
            <>
              <h1 className="text-2xl font-semibold">
                Conferma in corso...
              </h1>

              <p className="mt-3 text-white/50">
                Stiamo confermando la modifica della password.
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <h1 className="text-2xl font-semibold">
                Password modificata
              </h1>

              <p className="mt-3 text-white/50">
                {message}
              </p>

              <Link
                href="/dashboard"
                className="mt-6 inline-block rounded-xl bg-white px-6 py-3 font-medium text-black transition hover:bg-zinc-200"
              >
                Vai alla dashboard
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <h1 className="text-2xl font-semibold">
                Impossibile modificare la password
              </h1>

              <p className="mt-3 text-red-300">
                {message}
              </p>

              <Link
                href="/dashboard/profilo/password"
                className="mt-6 inline-block rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-medium text-white transition hover:bg-white/10"
              >
                Torna alla modifica password
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}