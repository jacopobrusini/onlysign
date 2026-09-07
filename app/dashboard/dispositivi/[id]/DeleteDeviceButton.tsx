"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DeleteDeviceButtonProps = {
  deviceId: number;
};

export default function DeleteDeviceButton({
  deviceId,
}: DeleteDeviceButtonProps) {
  const router = useRouter();

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    const confirmed = window.confirm(
      "Sei sicuro di voler eliminare questo dispositivo? Questa operazione non può essere annullata."
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/devices/${deviceId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Errore durante l'eliminazione del dispositivo."
        );
      }

      router.push("/dashboard/dispositivi");
      router.refresh();
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Errore durante l'eliminazione del dispositivo."
      );

      setDeleting(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-6 shadow-xl backdrop-blur-xl">

      <h2 className="text-lg font-semibold text-red-300">
        Zona pericolosa
      </h2>

      <p className="mt-2 text-sm text-white/50">
        L&apos;eliminazione del dispositivo rimuoverà la sua associazione
        dal tuo account.
      </p>

      {error && (
        <p className="mt-4 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 px-5 py-3 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {deleting ? "Eliminazione..." : "Elimina dispositivo"}
      </button>

    </div>
  );
}