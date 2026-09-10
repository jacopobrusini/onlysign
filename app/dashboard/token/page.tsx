import Link from "next/link";
import Header from "@/components/Header";
import { getSession } from "@/lib/session";
import { db } from "@/prisma/db";

const packages = [
  {
    tokens: 1,
    price: 2.5,
  },
  {
    tokens: 2,
    price: 5,
  },
  {
    tokens: 4,
    price: 10,
  },
  {
    tokens: 8,
    price: 20,
  },
  {
    tokens: 16,
    price: 36,
    originalPrice: 40,
    discount: 10,
  },
  {
    tokens: 32,
    price: 68,
    originalPrice: 80,
    discount: 15,
  },
  {
    tokens: 64,
    price: 128,
    originalPrice: 160,
    discount: 20,
  },
  {
    tokens: 128,
    price: 240,
    originalPrice: 320,
    discount: 25,
  },
];

export default async function TokenPage() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const users = await db.orm.public.User
    .where({
      id: session.user.id,
    })
    .all();

  const user = users[0];

  if (!user) {
    return null;
  }

  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <Header />

      <section className="px-6 pb-16 pt-28">
        <div className="mx-auto max-w-6xl">

          {/* Titolo */}
          <div className="mb-10">
            <p className="mb-2 text-sm uppercase tracking-[0.3em] text-white/60">
              Token
            </p>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Acquista token
            </h1>

            <p className="mt-3 text-white/60">
              Scegli il pacchetto di token da aggiungere al tuo account.
            </p>
          </div>

          {/* Saldo attuale */}
          <div className="mb-8 rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur-xl">
            <p className="text-sm text-white/50">
              Token disponibili
            </p>

            <div className="mt-2 flex items-end justify-between gap-4">
              <p className="text-4xl font-bold">
                {user.tokenBalance}
              </p>

              <Link
                href="/dashboard"
                className="text-sm font-medium text-white/60 transition hover:text-white"
              >
                ← Torna alla dashboard
              </Link>
            </div>
          </div>

          {/* Pacchetti */}
          <div>
            <div className="mb-5">
              <h2 className="text-xl font-semibold">
                Pacchetti disponibili
              </h2>

              <p className="mt-1 text-sm text-white/50">
                Più token acquisti, maggiore è lo sconto.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {packages.map((pkg) => (
                <div
                  key={pkg.tokens}
                  className="flex flex-col rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur-xl transition hover:bg-white/5"
                >
                  {/* Token */}
                  <div>
                    <p className="text-sm text-white/50">
                      Pacchetto
                    </p>

                    <p className="mt-2 text-3xl font-bold">
                      {pkg.tokens}
                      <span className="ml-2 text-base font-medium text-white/50">
                        {pkg.tokens === 1 ? "token" : "token"}
                      </span>
                    </p>
                  </div>

                  {/* Prezzo */}
                  <div className="mt-8">
                    <p className="text-sm text-white/50">
                      Prezzo
                    </p>

                    <div className="mt-2 flex flex-wrap items-baseline gap-2">
                      {pkg.originalPrice ? (
                        <>
                          <span className="text-base text-white/40 line-through">
                            €{pkg.originalPrice.toFixed(2)}
                          </span>

                          <span className="text-2xl font-bold">
                            €{pkg.price.toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className="text-2xl font-bold">
                          €{pkg.price.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {pkg.discount && (
                      <span className="mt-2 inline-block rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/60">
                        -{pkg.discount}%
                      </span>
                    )}
                  </div>

                  {/* Acquista */}
                  <button
                    type="button"
                    className="mt-8 w-full rounded-xl border border-white/10 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                  >
                    Acquista
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>
    </main>
  );
}