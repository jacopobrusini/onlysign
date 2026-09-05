import Link from "next/link";
import Header from "@/components/Header";

export default function InfoLegalePage() {
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
              Informazioni
            </p>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Info / Legale
            </h1>

            <p className="mt-3 max-w-2xl text-white/60">
              Informazioni sul servizio, condizioni di utilizzo e documentazione
              legale di onlySign.
            </p>
          </div>

          {/* Informazioni sul servizio */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur-xl">
            <h2 className="text-xl font-semibold">
              Informazioni sul servizio
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-white/50">
              onlySign è una piattaforma pensata per semplificare la gestione
              dei dispositivi associati al proprio account e dei relativi
              servizi di firma e registrazione.
            </p>
          </div>

          {/* Termini e condizioni */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur-xl">
            <h2 className="text-xl font-semibold">
              Termini e condizioni
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-white/50">
              L&apos;utilizzo di onlySign implica l&apos;accettazione dei
              termini e delle condizioni del servizio. L&apos;utente è
              responsabile dell&apos;utilizzo del proprio account e dei
              dispositivi associati.
            </p>

            <button
              type="button"
              className="mt-5 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Leggi i termini
            </button>
          </div>

          {/* Privacy */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur-xl">
            <h2 className="text-xl font-semibold">
              Privacy
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-white/50">
              La privacy degli utenti è importante per onlySign. In questa
              sezione saranno disponibili le informazioni relative ai dati
              raccolti, al loro utilizzo e alla loro conservazione.
            </p>

            <button
              type="button"
              className="mt-5 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Leggi la privacy policy
            </button>
          </div>

          {/* Uso del servizio */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur-xl">
            <h2 className="text-xl font-semibold">
              Uso del servizio
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-white/50">
              onlySign deve essere utilizzato nel rispetto delle leggi
              applicabili e delle condizioni stabilite dal servizio. Non è
              consentito utilizzare la piattaforma per attività illecite o per
              aggirare le restrizioni imposte dai servizi di terze parti.
            </p>
          </div>

          {/* Contatti */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur-xl">
            <h2 className="text-xl font-semibold">
              Contatti
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-white/50">
              Per informazioni, assistenza o richieste relative al servizio,
              sarà possibile contattare il team onlySign attraverso i canali
              ufficiali indicati sul sito.
            </p>
          </div>

          {/* Torna alla dashboard */}
          <div className="mt-8 text-center">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-white/60 transition hover:text-white"
            >
              ← Torna alla dashboard
            </Link>
          </div>

        </div>
      </section>
    </main>
  );
}