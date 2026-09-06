"use client";

import { useState } from "react";
import Link from "next/link";

type PasswordFormProps = {
  email: string;
  emailVerified: boolean;
};

export default function PasswordForm({
  email,
  emailVerified,
}: PasswordFormProps) {
  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess(false);
    setFieldErrors({});

    if (!emailVerified) {
      setError(
        "Devi verificare il tuo indirizzo e-mail prima di modificare la password."
      );
      return;
    }

    if (!currentPassword) {
      setFieldErrors({
        currentPassword:
          "Inserisci la password attuale.",
      });
      return;
    }

    if (
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      setFieldErrors({
        newPassword:
          "La password deve avere almeno 8 caratteri, una maiuscola e un numero.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFieldErrors({
        confirmPassword:
          "Le password non coincidono.",
      });
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        "/api/account/password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
            confirmPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (
          data.field === "currentPassword" ||
          data.field === "newPassword" ||
          data.field === "confirmPassword"
        ) {
          setFieldErrors({
            [data.field]: data.error,
          });
        } else {
          setError(
            data.error ||
              "Impossibile modificare la password."
          );
        }

        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch {
      setError(
        "Si è verificato un errore di connessione. Riprova."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur-xl">
      {success ? (
        <div>
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4">
            <p className="font-medium text-emerald-300">
              Controlla la tua e-mail
            </p>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Ti abbiamo inviato un link a{" "}
              <span className="text-white/80">
                {email}
              </span>{" "}
              per confermare la modifica della password.
            </p>
          </div>

          <Link
            href="/dashboard/profilo"
            className="mt-5 inline-block rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Torna al profilo
          </Link>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          {/* Password attuale */}
          <div>
            <label
              htmlFor="currentPassword"
              className="mb-2 block text-sm text-white/50"
            >
              Password attuale
            </label>

            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              disabled={saving}
              onChange={(event) => {
                setCurrentPassword(
                  event.target.value
                );

                if (fieldErrors.currentPassword) {
                  setFieldErrors((current) => ({
                    ...current,
                    currentPassword: undefined,
                  }));
                }
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/20 focus:border-white/30 focus:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Inserisci la password attuale"
            />

            {fieldErrors.currentPassword && (
              <p className="mt-2 text-xs text-red-300">
                {fieldErrors.currentPassword}
              </p>
            )}
          </div>

          {/* Nuova password */}
          <div>
            <label
              htmlFor="newPassword"
              className="mb-2 block text-sm text-white/50"
            >
              Nuova password
            </label>

            <input
              id="newPassword"
              type="password"
              value={newPassword}
              disabled={saving}
              onChange={(event) => {
                setNewPassword(
                  event.target.value
                );

                if (fieldErrors.newPassword) {
                  setFieldErrors((current) => ({
                    ...current,
                    newPassword: undefined,
                  }));
                }
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/20 focus:border-white/30 focus:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Inserisci la nuova password"
            />

            <p className="mt-2 text-xs text-white/40">
              Minimo 8 caratteri, una maiuscola e un numero.
            </p>

            {fieldErrors.newPassword && (
              <p className="mt-2 text-xs text-red-300">
                {fieldErrors.newPassword}
              </p>
            )}
          </div>

          {/* Conferma password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm text-white/50"
            >
              Conferma nuova password
            </label>

            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              disabled={saving}
              onChange={(event) => {
                setConfirmPassword(
                  event.target.value
                );

                if (fieldErrors.confirmPassword) {
                  setFieldErrors((current) => ({
                    ...current,
                    confirmPassword: undefined,
                  }));
                }
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/20 focus:border-white/30 focus:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Ripeti la nuova password"
            />

            {fieldErrors.confirmPassword && (
              <p className="mt-2 text-xs text-red-300">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-300">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Link
              href="/dashboard/profilo"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Annulla
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Invio..."
                : "Modifica password"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}