"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Status = "loading" | "success" | "error";

export default function ConfermaEliminazionePage() {
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

    const deletionToken = token;

    async function confirmDeletion() {
      try {
        const response = await fetch(
          `/api/account/delete/confirm?token=${encodeURIComponent(deletionToken)}`
        );

        const data = await response.json();

        if (!response.ok) {
          setStatus("error");
          setMessage(
            data.error ||
              "Impossibile eliminare l'account."
          );
          return;
        }

        setStatus("success");
        setMessage(
          "Il tuo account è stato eliminato definitivamente."
        );
      } catch {
        setStatus("error");
        setMessage(
          "Si è verificato un errore di connessione."
        );
      }
    }

    confirmDeletion();
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
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                ...
              </div>

              <h1 className="mt-6 text-2xl font-semibold">
                Eliminazione in corso...
              </h1>

              <p className="mt-3 text-white/50">
                Stiamo eliminando definitivamente il tuo account.
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-xl text-red-300">
                ✓
              </div>

              <h1 className="mt-6 text-2xl font-semibold">
                Account eliminato
              </h1>

              <p className="mt-3 leading-7 text-white/50">
                {message}
              </p>

              <Link
                href="/"
                className="mt-7 inline-block rounded-xl bg-white px-6 py-3 font-medium text-black transition hover:bg-zinc-200"
              >
                Torna alla Home
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <h1 className="text-2xl font-semibold">
                Impossibile eliminare l&apos;account
              </h1>

              <p className="mt-3 text-red-300">
                {message}
              </p>

              <Link
                href="/dashboard/profilo"
                className="mt-7 inline-block rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-medium text-white transition hover:bg-white/10"
              >
                Torna al profilo
              </Link>
            </>
          )}

        </div>
      </div>
    </main>
  );
}