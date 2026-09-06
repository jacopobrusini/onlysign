"use client";

import Link from "next/link";
import Header from "@/components/Header";
import { useEffect, useState } from "react";

type User = {
  id: number;
  username: string;
  email: string;
  emailVerified: boolean;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me");

        if (!response.ok) {
          setUser(null);
          return;
        }

        const data = await response.json();

        setUser(data.user ?? null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <Header />

      <section className="flex min-h-screen items-center justify-center px-6 pb-12 pt-24 sm:pb-16 sm:pt-24">
        <div className="max-w-3xl text-center">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
            onlySign
          </p>

          <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
            Your apps.
            <br />
            Your devices.
            <br />
            <span className="text-zinc-500">Your way.</span>
          </h1>

          <p className="mx-auto mt-8 max-w-xl text-lg leading-8 text-zinc-400">
            Gestisci i tuoi dispositivi, acquista token e prepara i tuoi
            certificati in modo semplice e trasparente.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            {!loading && user ? (
              <Link
                href="/dashboard"
                className="rounded-xl bg-white px-7 py-3 font-medium text-black transition hover:bg-zinc-200"
              >
                Dashboard
              </Link>
            ) : !loading ? (
              <Link
                href="/registrazione"
                className="rounded-xl bg-white px-7 py-3 font-medium text-black transition hover:bg-zinc-200"
              >
                Crea account
              </Link>
            ) : (
              <div className="h-[46px] w-[140px] rounded-xl bg-white/10" />
            )}

            <Link
              href="/prezzi"
              className="rounded-xl border border-white/20 px-7 py-3 font-medium text-white transition hover:bg-white/10"
            >
              Vedi i prezzi
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
              <p className="text-2xl font-bold">€2</p>
              <p className="mt-1 text-sm text-zinc-500">1 token</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
              <p className="text-2xl font-bold">€8</p>
              <p className="mt-1 text-sm text-zinc-500">5 token</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
              <p className="text-2xl font-bold">€10</p>
              <p className="mt-1 text-sm text-zinc-500">10 token</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}