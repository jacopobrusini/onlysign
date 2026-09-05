"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormEvent, useState } from "react";
import Header from "@/components/Header";

export default function RegistrationPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [loading, setLoading] = useState(false);

  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
  }>({});

  const passwordRules = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  };

  const passwordValid =
    passwordRules.length &&
    passwordRules.uppercase &&
    passwordRules.number;

  const validate = () => {
    const newErrors: typeof errors = {};

    if (!username.trim()) {
      newErrors.username = "Inserisci un username.";
    } else if (username.trim().length < 3) {
      newErrors.username =
        "L'username deve avere almeno 3 caratteri.";
    }

    if (!email.trim()) {
      newErrors.email = "Inserisci la tua email.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email =
        "Inserisci un indirizzo email valido.";
    }

    if (!password) {
      newErrors.password = "Inserisci una password.";
    } else if (!passwordValid) {
      newErrors.password =
        "La password non soddisfa tutti i requisiti.";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword =
        "Conferma la password.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword =
        "Le password non coincidono.";
    }

    if (!acceptedTerms) {
      newErrors.terms =
        "Devi accettare i Termini e la Privacy Policy.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          password,
          confirmPassword,
          acceptedTerms,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors((current) => ({
          ...current,
          [data.field || "email"]: data.error,
        }));

        return;
      }

      router.push(
        `/verifica-email?email=${encodeURIComponent(email)}`
      );
    } catch (error) {
      console.error("Errore di connessione:", error);

      setErrors((current) => ({
        ...current,
        email:
          "Si è verificato un errore di connessione. Riprova.",
      }));
    } finally {
      setLoading(false);
    }
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value);

    setErrors((current) => ({
      ...current,
      password: undefined,
    }));

    if (confirmPassword) {
      setErrors((current) => ({
        ...current,
        confirmPassword:
          value === confirmPassword
            ? undefined
            : "Le password non coincidono.",
      }));
    }
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);

    if (!value) {
      setErrors((current) => ({
        ...current,
        confirmPassword: undefined,
      }));
      return;
    }

    setErrors((current) => ({
      ...current,
      confirmPassword:
        value === password
          ? undefined
          : "Le password non coincidono.",
    }));
  };

  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <Header />

      <section className="flex min-h-screen items-center justify-center px-6 pb-16 pt-28">
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
            <form
              className="space-y-5"
              onSubmit={handleSubmit}
              noValidate
            >

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
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);

                    setErrors((current) => ({
                      ...current,
                      username: undefined,
                    }));
                  }}
                  placeholder="Scegli un username"
                  autoComplete="username"
                  className={`w-full rounded-xl border bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:bg-black/30 ${
                    errors.username
                      ? "border-red-400/60"
                      : "border-white/15 focus:border-white/40"
                  }`}
                />

                {errors.username && (
                  <p className="mt-2 text-xs text-red-300">
                    {errors.username}
                  </p>
                )}
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
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);

                    setErrors((current) => ({
                      ...current,
                      email: undefined,
                    }));
                  }}
                  placeholder="nome@email.com"
                  autoComplete="email"
                  className={`w-full rounded-xl border bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:bg-black/30 ${
                    errors.email
                      ? "border-red-400/60"
                      : "border-white/15 focus:border-white/40"
                  }`}
                />

                {errors.email && (
                  <p className="mt-2 text-xs text-red-300">
                    {errors.email}
                  </p>
                )}
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
                  value={password}
                  onChange={(event) =>
                    handlePasswordChange(
                      event.target.value
                    )
                  }
                  placeholder="Scegli una password"
                  autoComplete="new-password"
                  className={`w-full rounded-xl border bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:bg-black/30 ${
                    errors.password
                      ? "border-red-400/60"
                      : "border-white/15 focus:border-white/40"
                  }`}
                />

                {/* Requisiti password */}
                <div className="mt-3 space-y-1.5 text-xs">
                  <p
                    className={
                      passwordRules.length
                        ? "text-emerald-300"
                        : "text-zinc-500"
                    }
                  >
                    {passwordRules.length ? "✓" : "○"}{" "}
                    Almeno 8 caratteri
                  </p>

                  <p
                    className={
                      passwordRules.uppercase
                        ? "text-emerald-300"
                        : "text-zinc-500"
                    }
                  >
                    {passwordRules.uppercase ? "✓" : "○"}{" "}
                    Una lettera maiuscola
                  </p>

                  <p
                    className={
                      passwordRules.number
                        ? "text-emerald-300"
                        : "text-zinc-500"
                    }
                  >
                    {passwordRules.number ? "✓" : "○"}{" "}
                    Un numero
                  </p>
                </div>

                {errors.password && (
                  <p className="mt-2 text-xs text-red-300">
                    {errors.password}
                  </p>
                )}
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
                  value={confirmPassword}
                  onChange={(event) =>
                    handleConfirmPasswordChange(
                      event.target.value
                    )
                  }
                  placeholder="Ripeti la password"
                  autoComplete="new-password"
                  className={`w-full rounded-xl border bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:bg-black/30 ${
                    errors.confirmPassword
                      ? "border-red-400/60"
                      : "border-white/15 focus:border-white/40"
                  }`}
                />

                {confirmPassword &&
                  password === confirmPassword && (
                    <p className="mt-2 text-xs text-emerald-300">
                      ✓ Le password coincidono
                    </p>
                  )}

                {errors.confirmPassword && (
                  <p className="mt-2 text-xs text-red-300">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Termini e Privacy */}
              <div className="pt-1">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) => {
                      setAcceptedTerms(
                        event.target.checked
                      );

                      if (event.target.checked) {
                        setErrors((current) => ({
                          ...current,
                          terms: undefined,
                        }));
                      }
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-white"
                  />

                  <span className="text-xs leading-5 text-zinc-400">
                    Accetto i{" "}
                    <Link
                      href="/dashboard/info"
                      className="text-white transition hover:text-zinc-300"
                    >
                      Termini e Condizioni
                    </Link>{" "}
                    e la{" "}
                    <Link
                      href="/dashboard/info"
                      className="text-white transition hover:text-zinc-300"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>

                {errors.terms && (
                  <p className="mt-2 text-xs text-red-300">
                    {errors.terms}
                  </p>
                )}
              </div>

              {/* Registrazione */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-white py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Creazione account in corso..."
                  : "Crea account"}
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