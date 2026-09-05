"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

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
            onClick={onClose}
            className="text-2xl text-white/70 transition hover:text-white"
            aria-label="Chiudi menu"
          >
            ×
          </button>
        </div>

        {/* Account / Dashboard */}
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
            Jacopo
          </p>

          <p className="mt-1 text-xs text-white/40">
            10 token disponibili
          </p>
        </Link>

        {/* Account menu */}
        <nav className="mt-4 flex-1 space-y-1.5 overflow-y-auto">

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

          {/* Prezzi */}
          <Link
            href="/prezzi"
            onClick={onClose}
            className={`mt-3 block rounded-xl px-4 py-3 text-white transition hover:bg-white/10 ${
              isActive("/prezzi")
                ? "bg-white/15 shadow-lg backdrop-blur-md"
                : ""
            }`}
          >
            Prezzi
          </Link>

          {/* FAQ */}
          <Link
            href="/faq"
            onClick={onClose}
            className={`block rounded-xl px-4 py-3 text-white transition hover:bg-white/10 ${
              isActive("/faq")
                ? "bg-white/15 shadow-lg backdrop-blur-md"
                : ""
            }`}
          >
            FAQ
          </Link>

          {/* Info / Legale */}
          <Link
            href="/dashboard/info"
            onClick={onClose}
            className={`block rounded-xl px-4 py-3 text-white transition hover:bg-white/10 ${
              isActive("/dashboard/info")
                ? "bg-white/15 shadow-lg backdrop-blur-md"
                : ""
            }`}
          >
            Info / Legale
          </Link>

        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 pt-4">

          <button
            className="w-full rounded-xl px-4 py-3 text-left text-red-300 transition hover:bg-red-500/10"
          >
            Logout
          </button>

        </div>
      </aside>
    </>
  );
}