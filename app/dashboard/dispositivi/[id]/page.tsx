import Link from "next/link";
import Header from "@/components/Header";

type DevicePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DevicePage({ params }: DevicePageProps) {
  const { id } = await params;

  const device =
    id === "2"
      ? {
          name: "iPhone 13",
          ios: "iOS 18.5",
          udid: "B2C3D4E5-F6A7-8901-BCDE-2345678901AB",
          certificateReady: true,
        }
      : {
          name: "iPhone 15 Pro",
          ios: "iOS 18.6",
          udid: "A1B2C3D4-E5F6-7890-ABCD-1234567890AB",
          certificateReady: false,
        };

  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <Header />

      <section className="px-6 pb-16 pt-28">
        <div className="mx-auto max-w-4xl">

          {/* Titolo */}
          <div className="mb-10">
            <p className="mb-2 text-sm uppercase tracking-[0.3em] text-white/60">
              Dispositivo
            </p>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              {device.name}
            </h1>

            <p className="mt-3 text-white/60">
              Gestisci il dispositivo e il relativo certificato.
            </p>
          </div>

          {/* Informazioni dispositivo */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur-xl">
            <h2 className="text-xl font-semibold">
              Informazioni dispositivo
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">

              {/* Modello */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                  Modello
                </p>

                <p className="mt-2 text-white">
                  {device.name}
                </p>
              </div>

              {/* iOS */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                  Versione iOS
                </p>

                <p className="mt-2 text-white">
                  {device.ios}
                </p>
              </div>

              {/* UDID */}
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                  UDID
                </p>

                <p className="mt-2 break-all font-mono text-sm text-white/70">
                  {device.udid}
                </p>
              </div>

            </div>
          </div>

          {/* Certificato */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur-xl">

            <h2 className="text-xl font-semibold">
              Certificato
            </h2>

            <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex items-center gap-3">

                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    device.certificateReady
                      ? "bg-emerald-400"
                      : "bg-red-400"
                  }`}
                />

                <span
                  className={`text-sm font-medium ${
                    device.certificateReady
                      ? "text-emerald-300"
                      : "text-red-300"
                  }`}
                >
                  {device.certificateReady
                    ? "Certificato pronto"
                    : "Certificato non acquistato"}
                </span>

              </div>

              {device.certificateReady ? (
                <button
                  type="button"
                  className="rounded-xl bg-white px-6 py-3 text-center font-medium text-black transition hover:bg-zinc-200"
                >
                  Scarica certificato
                </button>
              ) : (
                <Link
                  href="/prezzi"
                  className="rounded-xl bg-white px-6 py-3 text-center font-medium text-black transition hover:bg-zinc-200"
                >
                  Acquista certificato
                </Link>
              )}

            </div>

          </div>

          {/* Torna ai dispositivi */}
          <div className="mt-8 text-center">
            <Link
              href="/dashboard/dispositivi"
              className="text-sm font-medium text-white/60 transition hover:text-white"
            >
              ← Torna ai dispositivi
            </Link>
          </div>

        </div>
      </section>
    </main>
  );
}