"use client";

import { useState } from "react";

type BuyTokenButtonProps = {
  packageId: number;
};

export default function BuyTokenButton({
  packageId,
}: BuyTokenButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handlePurchase() {
    if (loading) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/paymos/create-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          packageId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.paymentUrl) {
        throw new Error(
          data.error || "Impossibile creare il pagamento"
        );
      }

      window.location.href = data.paymentUrl;
    } catch (error) {
      console.error("Errore acquisto token:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Si è verificato un errore"
      );

      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handlePurchase}
      disabled={loading}
      className="mt-8 w-full rounded-xl border border-white/10 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Creazione pagamento..." : "Acquista"}
    </button>
  );
}