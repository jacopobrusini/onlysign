"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type ProfiloFormProps = {
  username: string;
  email: string;
  emailVerified: boolean;
};

export default function ProfiloForm({
  username: initialUsername,
  email: initialEmail,
  emailVerified,
}: ProfiloFormProps) {
  const router = useRouter();

  const [editing, setEditing] = useState(false);

  const [username, setUsername] = useState(initialUsername);
  const [email, setEmail] = useState(initialEmail);

  const [originalUsername, setOriginalUsername] =
    useState(initialUsername);

  const [originalEmail, setOriginalEmail] =
    useState(initialEmail);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    email?: string;
  }>({});

  function handleEdit() {
    setOriginalUsername(username);
    setOriginalEmail(email);
    setError("");
    setFieldErrors({});
    setEditing(true);
  }

  function handleCancel() {
    setUsername(originalUsername);
    setEmail(originalEmail);
    setError("");
    setFieldErrors({});
    setEditing(false);
  }

  async function handleSave() {
    setError("");
    setFieldErrors({});

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanUsername) {
      setFieldErrors({
        username: "Inserisci un nome profilo.",
      });
      return;
    }

    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      setFieldErrors({
        username:
          "Il nome profilo deve avere tra 3 e 30 caratteri.",
      });
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setFieldErrors({
        username:
          "Il nome profilo può contenere solo lettere, numeri e underscore.",
      });
      return;
    }

    if (!cleanEmail) {
      setFieldErrors({
        email: "Inserisci un indirizzo e-mail.",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFieldErrors({
        email: "Inserisci un indirizzo e-mail valido.",
      });
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/account/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: cleanUsername,
          email: cleanEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.field === "username") {
          setFieldErrors({
            username: data.error,
          });
        } else if (data.field === "email") {
          setFieldErrors({
            email: data.error,
          });
        } else {
          setError(
            data.error ||
              "Impossibile aggiornare l'account."
          );
        }

        return;
      }

      setOriginalUsername(data.user.username);
      setOriginalEmail(data.user.email);

      setUsername(data.user.username);
      setEmail(data.user.email);

      setEditing(false);

      /*
       * Se l'e-mail è cambiata, l'utente deve
       * verificare il nuovo indirizzo.
       */
      if (data.emailChanged) {
        router.push(
          `/verifica-email?email=${encodeURIComponent(
            data.user.email
          )}&changed=1`
        );

        return;
      }
    } catch {
      setError(
        "Si è verificato un errore di connessione. Riprova."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Informazioni account */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              Informazioni account
            </h2>

            <p className="mt-1 text-sm text-white/40">
              Le informazioni associate al tuo account.
            </p>
          </div>

          {!editing ? (
            <button
              type="button"
              onClick={handleEdit}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Modifica
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Annulla
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Salvataggio..."
                  : "Salva modifiche"}
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {/* Nome profilo */}
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-sm text-white/50"
            >
              Nome profilo
            </label>

            <input
              id="username"
              type="text"
              value={username}
              disabled={!editing || saving}
              onChange={(event) => {
                setUsername(event.target.value);

                if (fieldErrors.username) {
                  setFieldErrors((current) => ({
                    ...current,
                    username: undefined,
                  }));
                }
              }}
              className={`w-full rounded-xl border px-4 py-3 text-white outline-none transition ${
                editing
                  ? "border-white/20 bg-white/10 focus:border-white/40 focus:bg-white/15"
                  : "border-white/10 bg-white/5"
              }`}
            />

            {fieldErrors.username && (
              <p className="mt-2 text-xs text-red-300">
                {fieldErrors.username}
              </p>
            )}
          </div>

          {/* E-mail */}
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm text-white/50"
            >
              E-mail
            </label>

            <input
              id="email"
              type="email"
              value={email}
              disabled={!editing || saving}
              onChange={(event) => {
                setEmail(event.target.value);

                if (fieldErrors.email) {
                  setFieldErrors((current) => ({
                    ...current,
                    email: undefined,
                  }));
                }
              }}
              className={`w-full rounded-xl border px-4 py-3 text-white outline-none transition ${
                editing
                  ? "border-white/20 bg-white/10 focus:border-white/40 focus:bg-white/15"
                  : "border-white/10 bg-white/5"
              }`}
            />

            {fieldErrors.email && (
              <p className="mt-2 text-xs text-red-300">
                {fieldErrors.email}
              </p>
            )}
          </div>
        </div>

        {/* Errore generale */}
        {error && (
          <p className="mt-4 text-sm text-red-300">
            {error}
          </p>
        )}

        {editing && (
          <p className="mt-4 text-xs text-white/40">
            Puoi modificare il nome profilo e l&apos;e-mail.
          </p>
        )}
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

      {/* Sicurezza account */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur-xl">
        <h2 className="text-xl font-semibold">
          Sicurezza account
        </h2>

        <div className="mt-5 space-y-4">
          {/* Email verificata */}
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
            <div>
              <p className="font-medium">
                E-mail
              </p>

              <p className="mt-1 text-sm text-white/40">
                Indirizzo e-mail dell&apos;account
              </p>
            </div>

            <span
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                emailVerified
                  ? "bg-emerald-400/10 text-emerald-300"
                  : "bg-yellow-400/10 text-yellow-300"
              }`}
            >
              {emailVerified
                ? "Verificata"
                : "Non verificata"}
            </span>
          </div>

          {/* Sessione */}
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
            <div>
              <p className="font-medium">
                Sessione
              </p>

              <p className="mt-1 text-sm text-white/40">
                Questo dispositivo è attualmente autenticato.
              </p>
            </div>

            <span className="rounded-lg bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
              Attiva
            </span>
          </div>
        </div>
      </div>

      {/* Eliminazione account */}
      <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/5 p-6 shadow-xl backdrop-blur-xl">
        <h2 className="text-xl font-semibold text-red-200">
          Zona pericolosa
        </h2>

        <p className="mt-2 max-w-2xl text-sm text-white/50">
          L&apos;eliminazione dell&apos;account rimuoverà
          definitivamente i dati associati al tuo profilo.
          Questa operazione non può essere annullata.
        </p>

        <button
          type="button"
          className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 px-6 py-3 font-medium text-red-200 transition hover:bg-red-500/20"
        >
          Elimina account
        </button>
      </div>
    </>
  );
}