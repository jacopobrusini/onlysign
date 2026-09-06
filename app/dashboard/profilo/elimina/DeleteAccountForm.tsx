"use client";

import Link from "next/link";
import { useState } from "react";

type DeleteAccountFormProps = {
  email: string;
  emailVerified: boolean;
};

export default function DeleteAccountForm({
  email,
  emailVerified,
}: DeleteAccountFormProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    setError("");

    if (!password) {
      setError("Inserisci la password attuale.");
      return;
    }

    if (!emailVerified) {
      setError(
        "Devi verificare il tuo indirizzo e-mail prima di eliminare l'account."
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Impossibile procedere con l'eliminazione dell'account."
        );
        return;
      }

      setSuccess(true);
      setPassword("");
    } catch {
      setError(
        "Si è verificato un errore di connessione."
      );
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-8 shadow-2xl backdrop-blur-2xl">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl">
          ✓
        </div>

        <h2 className="mt-6 text-2xl font-semibold">
          Controlla la tua e-mail
        </h2>

        <p className="mt-3 leading-7 text-white/50">
          Abbiamo inviato un link di conferma a:
        </p>

        <p className="mt-2 break-all font-medium text-white">
          {email}
        </p>

        <p className="mt-4 text-sm leading-6 text-white/40">
          Per eliminare definitivamente il tuo account,
          clicca sul link contenuto nell&apos;e-mail. Il link
          sarà valido per 24 ore.
        </p>

        <Link
          href="/dashboard/profilo"
          className="mt-7 inline-block rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-medium text-white transition hover:bg-white/10"
        >
          Torna al profilo
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-red-500/20 bg-black/30 p-8 shadow-2xl backdrop-blur-2xl">
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <p className="text-sm leading-6 text-red-200/80">
          Attenzione: eliminando il tuo account perderai
          definitivamente l&apos;accesso ai tuoi dati e ai servizi
          associati all&apos;account.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-7"
      >
        <label
          htmlFor="password"
          className="block text-sm font-medium text-white/80"
        >
          Password attuale
        </label>

        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          disabled={saving}
          autoComplete="current-password"
          placeholder="Inserisci la tua password"
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/25 focus:border-white/20 focus:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        />

        {error && (
          <p className="mt-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={saving || !emailVerified}
            className="rounded-xl bg-red-500/90 px-6 py-3 font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Eliminazione in corso..."
              : "Continua"}
          </button>

          <Link
            href="/dashboard/profilo"
            className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-center font-medium text-white transition hover:bg-white/10"
          >
            Annulla
          </Link>
        </div>
      </form>
    </div>
  );
}