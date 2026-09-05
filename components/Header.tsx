"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Sidebar from "./Sidebar";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-60 flex h-16 items-center justify-between border-b border-white/15 bg-white/5 px-3 md:px-5 backdrop-blur-xl">
        {/* Menu */}
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="relative z-60 flex h-12 w-12 items-center justify-center text-3xl text-white transition hover:text-zinc-400"
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
          <Link
            href="/dashboard"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right transition hover:bg-white/10"
          >
            <p className="text-sm font-medium text-white">
              Jacopo
            </p>

            <p className="mt-0.5 text-[11px] text-white/40">
              10 token disponibili
            </p>
          </Link>
        </div>
      </header>

      <Sidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
    </>
  );
}