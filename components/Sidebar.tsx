"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";

type User = {
  id: number;
  username: string;
  email: string;
  emailVerified: boolean;
};

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  user: User | null;
  loading: boolean;
};

export default function Sidebar({
  open,
  onClose,
  user,
  loading,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [loggingOut, setLoggingOut] = useState(false);

  const isActive = (path: string) => pathname === path;

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      onClose();
      router.push("/");
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-80 flex-col border-r border-white/10 bg-black/40 p-5 shadow-2xl backdrop-blur-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header sidebar */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <Image
              src="/onlysign-icon.png"
              alt="onlySign"
              className="h-9 w-9 rounded-xl object-cover"
              width={36}
              height={36}
            />

            <span className="text-xl font-semibold tracking-wide">
              <span className="text-white">only</span>
              <span className="text-zinc-400">Sign</span>
            </span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="text-2xl text-white/70 transition hover:text-white"
            aria-label="Chiudi menu"
          >
            ×
          </button>
        </div>

        {/* Account */}
        {!loading && user ? (
          <Link
            href="/dashboard"
            onClick={onClose}
            className={`mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10 ${
              isActive("/dashboard")
                ? "bg-white/10 shadow-lg"
                : ""
            }`}
          >
            <p className="font-medium text-white">
              {user.username}
            </p>

            <p className="mt-1 text-xs text-white/40">
              Account
            </p>
          </Link>
        ) : !loading ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="font-medium text-white">
              Non hai un account?
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                href="/registrazione"
                onClick={onClose}
                className="rounded-xl bg-white px-3 py-2 text-center text-sm font-medium text-black transition hover:bg-zinc-200"
              >
                Registrati
              </Link>

              <Link
                href="/login"
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-sm font-medium text-white transition hover:bg-white/10"
              >
                Accedi
              </Link>
            </div>
          </div>
        ) : null}

        {/* Navigation */}
        <nav className="mt-4 flex-1 space-y-1.5 overflow-y-auto">
          {/* Account */}
          {user && (
            <>
              <p className="px-4 pb-2 pt-2 text-xs uppercase tracking-[0.2em] text-white/30">
                Account
              </p>

              {/* Profilo */}
              <Link
                href="/dashboard/profilo"
                onClick={onClose}
                className={`ml-4 block rounded-xl px-4 py-3 text-white transition hover:bg-white/10 ${
                  isActive("/dashboard/profilo")
                    ? "bg-white/10 shadow-md backdrop-blur-md"
                    : "bg-white/5 shadow-sm"
                }`}
              >
                Profilo
              </Link>

              {/* Dispositivi */}
              <Link
                href="/dashboard/dispositivi"
                onClick={onClose}
                className={`ml-4 block rounded-xl px-4 py-3 text-white transition hover:bg-white/10 ${
                  isActive("/dashboard/dispositivi")
                    ? "bg-white/10 shadow-md backdrop-blur-md"
                    : "bg-white/5 shadow-sm"
                }`}
              >
                Dispositivi
              </Link>

              <div className="my-4 border-t border-white/10" />
            </>
          )}

          {/* Pubblico */}
          <p className="px-4 pb-2 pt-2 text-xs uppercase tracking-[0.2em] text-white/30">
            Pubblico
          </p>

          {/* Prezzi */}
          <Link
            href="/prezzi"
            onClick={onClose}
            className={`block rounded-xl px-4 py-3 text-white transition hover:bg-white/10 ${
              isActive("/prezzi")
                ? "bg-white/15 shadow-lg backdrop-blur-md"
                : "bg-white/5 shadow-sm"
            }`}
          >
            Prezzi
          </Link>

          {/* Come funziona */}
          <Link
            href="/come-funziona"
            onClick={onClose}
            className={`block rounded-xl px-4 py-3 text-white transition hover:bg-white/10 ${
              isActive("/come-funziona")
                ? "bg-white/15 shadow-lg backdrop-blur-md"
                : "bg-white/5 shadow-sm"
            }`}
          >
            Come funziona
          </Link>

          {/* FAQ */}
          <Link
            href="/faq"
            onClick={onClose}
            className={`block rounded-xl px-4 py-3 text-white transition hover:bg-white/10 ${
              isActive("/faq")
                ? "bg-white/15 shadow-lg backdrop-blur-md"
                : "bg-white/5 shadow-sm"
            }`}
          >
            FAQ
          </Link>

          {/* Info / Legale */}
          <Link
            href="/info"
            onClick={onClose}
            className={`block rounded-xl px-4 py-3 text-white transition hover:bg-white/10 ${
              isActive("/info")
                ? "bg-white/15 shadow-lg backdrop-blur-md"
                : "bg-white/5 shadow-sm"
            }`}
          >
            Info / Legale
          </Link>
        </nav>

        {/* Footer */}
        {user && (
          <div className="border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full rounded-xl px-4 py-3 text-left text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loggingOut ? "Logout in corso..." : "Logout"}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}