"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Sidebar from "./Sidebar";

type User = {
  id: number;
  username: string;
  email: string;
  emailVerified: boolean;
};

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        const data = await response.json();

        if (data.authenticated) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    checkSession();
  }, []);

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-60 flex h-16 items-center justify-between border-b border-white/15 bg-white/5 px-3 backdrop-blur-xl md:px-5">
        {/* Menu */}
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="relative z-60 -ml-2 flex h-12 w-12 items-center justify-center text-3xl text-white transition hover:text-zinc-400"
          aria-label={menuOpen ? "Chiudi menu" : "Apri menu"}
        >
          ☰
        </button>

        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-80 md:absolute md:left-1/2 md:-translate-x-1/2"
          aria-label="Torna alla Home"
        >
          <Image
            src="/onlysign-icon.png"
            alt="onlySign"
            width={36}
            height={36}
            className="h-9 w-9 rounded-xl object-cover"
          />

          <span className="text-xl font-semibold tracking-wide">
            <span className="text-white">only</span>
            <span className="text-zinc-400">Sign</span>
          </span>
        </Link>

        {/* Account */}
        <div className="ml-auto flex items-center">
          {!loading && user ? (
            <Link
  href="/dashboard"
  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right transition hover:bg-white/10"
>
  <p className="text-sm font-medium text-white">
    {user.username}
  </p>

  <p className="mt-0.5 text-[11px] text-white/40">
    Account
  </p>
</Link>
          ) : !loading ? (
            <div className="flex items-center gap-2">
              <Link
                href="/registrazione"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Registrati
              </Link>

              <Link
                href="/login"
                className="rounded-xl bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
              >
                Accedi
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      <Sidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        loading={loading}
      />
    </>
  );
}