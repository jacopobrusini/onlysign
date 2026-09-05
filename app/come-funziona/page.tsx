import Header from "@/components/Header";

const steps = [
  {
    number: "01",
    title: "Crea un account",
    description:
      "Registrati gratuitamente su onlySign per accedere alla gestione dei tuoi dispositivi e dei tuoi token.",
  },
  {
    number: "02",
    title: "Aggiungi il tuo dispositivo",
    description:
      "Aggiungi il dispositivo che vuoi utilizzare inserendo il relativo UDID. Puoi anche condividere il link per ottenere l'UDID.",
  },
  {
    number: "03",
    title: "Acquista i token",
    description:
      "Scegli il pacchetto più adatto alle tue esigenze. I token rimangono disponibili nel tuo account finché non decidi di utilizzarli.",
  },
  {
    number: "04",
    title: "Usa un token",
    description:
      "Quando sei pronto, utilizza un token per richiedere un certificato per il dispositivo selezionato.",
  },
  {
    number: "05",
    title: "Gestisci il certificato",
    description:
      "Una volta disponibile, puoi visualizzare e gestire il certificato direttamente dalla sezione del dispositivo.",
  },
];

export default function HowItWorksPage() {
  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <Header />

      <section className="min-h-screen px-6 pb-20 pt-32">
        <div className="mx-auto max-w-5xl">
          {/* Titolo */}
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Come funziona
            </h1>

            <p className="mt-4 text-lg leading-8 text-zinc-400">
              Tutto ciò che ti serve, in pochi semplici passaggi.
            </p>
          </div>

          {/* Passaggi */}
          <div className="mt-14 grid gap-5 md:grid-cols-2">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className={`rounded-3xl border border-white/20 bg-white/10 p-7 shadow-2xl backdrop-blur-2xl ${
                  index === steps.length - 1 ? "md:col-span-2 md:mx-auto md:w-1/2" : ""
                }`}
              >
                <div className="flex items-start gap-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-bold text-black">
                    {step.number}
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold">
                      {step.title}
                    </h2>

                    <p className="mt-2 leading-7 text-zinc-400">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Token */}
          <div className="mx-auto mt-12 max-w-2xl rounded-3xl border border-white/20 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-2xl">
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
              Semplice da capire
            </p>

            <h2 className="mt-3 text-2xl font-bold">
              1 token = 1 certificato
            </h2>

            <p className="mt-3 leading-7 text-zinc-400">
              Acquista i token in anticipo e utilizzali solo quando ne hai
              bisogno. Il tuo saldo rimane sempre visibile nel tuo account.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}