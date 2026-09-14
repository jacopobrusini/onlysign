"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

type Purchase = {
  id: number;
  tokens: number;
  amount: number;
  status: string;
  paymentStatus: string | null;
  fundingStatus: string | null;
  paymosWithdrawalStatus: string | null;
};

function getPaymentStep(
  purchase: Purchase
) {
  const paymentStatus =
    purchase.paymentStatus;

  if (
    paymentStatus === "PAID" ||
    paymentStatus === "PAID_FUNDING" ||
    paymentStatus === "PAID_FUNDED" ||
    paymentStatus === "PAID_FUNDING_FAILED"
  ) {
    return "completed";
  }

  return "pending";
}

function getFundingStep(
  purchase: Purchase
) {
  if (
    purchase.paymentStatus ===
    "PAID_FUNDING_FAILED"
  ) {
    return "failed";
  }

  if (
    purchase.paymentStatus ===
    "PAID_FUNDED"
  ) {
    return "completed";
  }

  if (
    purchase.paymentStatus ===
      "PAID_FUNDING" ||
    purchase.fundingStatus ===
      "PENDING"
  ) {
    return "processing";
  }

  return "pending";
}

function getTokenStep(
  purchase: Purchase
) {
  if (
    purchase.paymentStatus ===
    "PAID_FUNDED"
  ) {
    return "completed";
  }

  return "pending";
}

export default function TokenSuccessPage() {
  const [purchases, setPurchases] =
    useState<Purchase[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const loadPurchases =
    useCallback(async () => {
      try {
        const response =
          await fetch(
            "/api/payments/paymos/pending",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        if (!response.ok) {
          throw new Error(
            "Impossibile caricare gli ordini."
          );
        }

        const data =
          await response.json();

        setPurchases(
          data.purchases ?? []
        );

        setError(null);
      } catch (error) {
        console.error(
          "Failed to load purchases:",
          error
        );

        setError(
          "Non è stato possibile caricare gli ordini."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    let cancelled = false;

    const initialLoad =
      async () => {
        if (cancelled) {
          return;
        }

        await loadPurchases();
      };

    initialLoad();

    const interval =
      setInterval(() => {
        if (!cancelled) {
          loadPurchases();
        }
      }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [loadPurchases]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url('/background.png')",
        }}
      />

      <div className="fixed inset-0 bg-black/30" />

      <div className="relative z-10 min-h-screen px-6 py-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-8">
            <Link
              href="/dashboard"
              className="mb-6 inline-flex items-center text-sm text-white/60 transition hover:text-white"
            >
              ← Torna alla dashboard
            </Link>

            <div className="flex items-center gap-3">
              <Image
                src="/onlysign-icon.png"
                alt="OnlySign"
                width={40}
                height={40}
                className="h-10 w-10 rounded-xl"
                priority
              />

              <div>
                <h1 className="text-3xl font-semibold tracking-tight">
                  Ordini in corso
                </h1>

                <p className="mt-1 text-sm text-white/60">
                  Qui puoi controllare lo stato
                  dei tuoi pagamenti e
                  dell&apos;accredito dei token.
                </p>
              </div>
            </div>
          </div>

          {loading && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />

              <p className="text-sm text-white/60">
                Caricamento ordini...
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6 shadow-2xl backdrop-blur-xl">
              <p className="text-sm text-red-200">
                {error}
              </p>

              <button
                onClick={loadPurchases}
                className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/15"
              >
                Riprova
              </button>
            </div>
          )}

          {!loading &&
            !error &&
            purchases.length === 0 && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-2xl backdrop-blur-xl">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl">
                  ✓
                </div>

                <h2 className="text-xl font-semibold">
                  Nessun ordine in corso
                </h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/50">
                  Non hai pagamenti o accrediti
                  di token in attesa di
                  elaborazione.
                </p>

                <Link
                  href="/prezzi"
                  className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  Acquista token
                </Link>
              </div>
            )}

          {!loading &&
            !error &&
            purchases.length > 0 && (
              <div className="space-y-5">
                {purchases.map(
                  (purchase) => {
                    const paymentStep =
                      getPaymentStep(
                        purchase
                      );

                    const fundingStep =
                      getFundingStep(
                        purchase
                      );

                    const tokenStep =
                      getTokenStep(
                        purchase
                      );

                    return (
                      <div
                        key={purchase.id}
                        className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl"
                      >
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-widest text-white/40">
                              Ordine #
                              {purchase.id}
                            </p>

                            <h2 className="mt-1 text-xl font-semibold">
                              {purchase.tokens}{" "}
                              {purchase.tokens ===
                              1
                                ? "token"
                                : "token"}
                            </h2>
                          </div>

                          <div className="text-left sm:text-right">
                            <p className="text-xl font-semibold">
                              €{" "}
                              {purchase.amount.toFixed(
                                2
                              )}
                            </p>

                            <p className="mt-1 text-xs text-white/40">
                              Pagamento Paymos
                            </p>
                          </div>
                        </div>

                        <div className="mt-7 space-y-4">
                          <StatusRow
                            state={
                              paymentStep
                            }
                            title="Pagamento ricevuto"
                            description={
                              paymentStep ===
                              "completed"
                                ? "Il pagamento è stato confermato."
                                : "In attesa della conferma del pagamento."
                            }
                          />

                          <StatusRow
                            state={
                              fundingStep
                            }
                            title="Funding PPQCheck"
                            description={
                              fundingStep ===
                              "completed"
                                ? "Il funding è stato completato."
                                : fundingStep ===
                                  "processing"
                                ? "Stiamo completando il funding del provider."
                                : fundingStep ===
                                  "failed"
                                ? "Si è verificato un problema durante il funding."
                                : "In attesa dell'elaborazione."
                            }
                          />

                          <StatusRow
                            state={
                              tokenStep
                            }
                            title="Token accreditati"
                            description={
                              tokenStep ===
                              "completed"
                                ? "I token sono disponibili nel tuo account."
                                : "I token verranno accreditati automaticamente al termine dell'elaborazione."
                            }
                          />
                        </div>

                        {fundingStep ===
                          "processing" && (
                          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className="text-xs leading-5 text-white/50">
                              Questa pagina si
                              aggiorna
                              automaticamente.
                              Non è necessario
                              effettuare un
                              nuovo pagamento.
                            </p>
                          </div>
                        )}

                        {fundingStep ===
                          "failed" && (
                          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3">
                            <p className="text-xs leading-5 text-red-200/80">
                              Il pagamento è
                              stato ricevuto,
                              ma il funding non
                              è stato completato.
                              Il nostro sistema
                              gestirà
                              automaticamente
                              l&apos;ordine.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            )}

          <div className="mt-8 text-center">
            <Link
              href="/dashboard"
              className="inline-flex rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Vai alla dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatusRow({
  state,
  title,
  description,
}: {
  state:
    | "pending"
    | "processing"
    | "completed"
    | "failed";
  title: string;
  description: string;
}) {
  const icon =
    state === "completed"
      ? "✓"
      : state === "processing"
      ? "◌"
      : state === "failed"
      ? "!"
      : "○";

  const iconClass =
    state === "completed"
      ? "bg-white text-black"
      : state === "processing"
      ? "bg-white/10 text-white"
      : state === "failed"
      ? "bg-red-500/20 text-red-200"
      : "bg-white/5 text-white/30";

  return (
    <div className="flex items-start gap-4">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${iconClass}`}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <p
          className={`text-sm font-medium ${
            state === "pending"
              ? "text-white/40"
              : "text-white"
          }`}
        >
          {title}
        </p>

        <p className="mt-0.5 text-xs leading-5 text-white/45">
          {description}
        </p>
      </div>
    </div>
  );
}