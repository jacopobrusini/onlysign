import Header from "@/components/Header";

const faqs = [
  {
    question: "Che cos'è onlySign?",
    answer:
      "onlySign è un servizio pensato per aiutarti a gestire i tuoi dispositivi, i tuoi token e i certificati associati in modo semplice e ordinato.",
  },
  {
    question: "Che cos'è un token?",
    answer:
      "Un token è un credito del tuo account. Ogni token può essere utilizzato per richiedere un certificato per un dispositivo.",
  },
  {
    question: "Quanto costa un token?",
    answer:
      "Un token costa €2. Sono disponibili anche pacchetti da 5 token a €8 e 10 token a €10.",
  },
  {
    question: "I token scadono?",
    answer:
      "No. I token acquistati rimangono disponibili nel tuo account e puoi utilizzarli quando ne hai bisogno.",
  },
  {
    question: "Posso aggiungere più dispositivi?",
    answer:
      "Sì. Puoi aggiungere e gestire più dispositivi dal tuo account.",
  },
  {
    question: "Come posso ottenere l'UDID del mio dispositivo?",
    answer:
      "onlySign mette a disposizione un link che puoi aprire dal dispositivo interessato per ottenere l'UDID e associarlo al tuo account.",
  },
  {
    question: "Dove trovo i miei certificati?",
    answer:
      "I certificati disponibili saranno gestibili direttamente dalla sezione Dispositivi del tuo account.",
  },
  {
    question: "Posso scaricare i miei file?",
    answer:
      "Sì. I file disponibili per il tuo account saranno raccolti nella sezione Download.",
  },
  {
    question: "onlySign è affiliato ad Apple?",
    answer:
      "No. onlySign è un servizio indipendente e non è affiliato, sponsorizzato o approvato da Apple Inc.",
  },
];

export default function FAQPage() {
  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <Header />

      <section className="min-h-screen px-6 pb-20 pt-32">
        <div className="mx-auto max-w-4xl">
          {/* Titolo */}
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Domande frequenti
            </h1>

            <p className="mt-4 text-lg leading-8 text-zinc-400">
              Tutte le risposte alle domande più comuni su onlySign.
            </p>
          </div>

          {/* FAQ */}
          <div className="mt-12 space-y-4">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-2xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-2xl"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-5 font-medium text-white">
                  <span>{faq.question}</span>

                  <span className="ml-4 text-2xl text-zinc-400 transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>

                <div className="border-t border-white/10 px-6 py-5">
                  <p className="leading-7 text-zinc-400">
                    {faq.answer}
                  </p>
                </div>
              </details>
            ))}
          </div>

          {/* Contatto */}
          <div className="mx-auto mt-12 max-w-2xl rounded-3xl border border-white/20 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-2xl">
            <h2 className="text-xl font-semibold">
              Non hai trovato quello che cercavi?
            </h2>

            <p className="mt-3 text-zinc-400">
              Contattaci e saremo felici di aiutarti.
            </p>

            <button
              type="button"
              className="mt-6 rounded-xl bg-white px-6 py-3 font-medium text-black transition hover:bg-zinc-200"
            >
              Contattaci
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}