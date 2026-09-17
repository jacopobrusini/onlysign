"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PurchaseCertificateButtonProps = {
  deviceId: number;
  certificateTypeId: number;
};

export default function PurchaseCertificateButton({
  deviceId,
  certificateTypeId,
}: PurchaseCertificateButtonProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePurchase() {
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    console.log("PURCHASE: handlePurchase START");
    console.log("PURCHASE: deviceId =", deviceId);
    console.log("PURCHASE: certificateTypeId =", certificateTypeId);

    try {
      console.log("PURCHASE: before fetch");

      const response = await fetch("/api/certificates/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceId,
          certificateTypeId,
        }),
      });

      console.log("PURCHASE: fetch completed", response.status);

      const data = await response.json();

      console.log("PURCHASE: response data", data);

      if (!response.ok) {
        throw new Error(
          data?.error || "Impossibile acquistare il certificato"
        );
      }

      router.push(`/dashboard/dispositivi/${deviceId}`);
    } catch (err) {
      console.error("Purchase certificate error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Si è verificato un errore"
      );

      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <button
        type="button"
        onClick={handlePurchase}
        disabled={loading}
        className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/40"
      >
        {loading ? "Acquisto in corso..." : "Acquista certificato"}
      </button>

      {error && (
        <p className="max-w-xs text-right text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}