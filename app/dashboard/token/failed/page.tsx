"use client";

import Link from "next/link";
import Image from "next/image";

export default function TokenPaymentFailedPage() {
  return (
    <main className="min-h-screen relative overflow-hidden bg-black text-white">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('/background.png')",
        }}
      />

      <div className="absolute inset-0 bg-black/30" />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl p-8 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-red-400/20 bg-red-400/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-10 w-10 text-red-300"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 6l12 12M18 6L6 18"
                />
              </svg>
            </div>

            <div className="mb-6 flex justify-center">
              <Image
  src="/onlysign-icon.png"
  alt="OnlySign"
  width={48}
  height={48}
  className="h-12 w-12"
/>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight">
              Pagamento non completato
            </h1>

            <p className="mt-3 text-sm leading-6 text-white/60">
              Il pagamento non è stato completato
              oppure è stato annullato.
            </p>

            <p className="mt-2 text-sm leading-6 text-white/50">
              Nessun token è stato accreditato sul
              tuo account.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <Link
                href="/prezzi"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-5 text-sm font-medium text-black transition hover:bg-white/90"
              >
                Torna ai pacchetti
              </Link>

              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Torna alla dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}