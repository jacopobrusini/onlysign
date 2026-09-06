import Header from "@/components/Header";
import { getSession } from "@/lib/session";
import ProfiloForm from "./ProfiloForm";

export default async function Profilo() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const user = session.user;

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
              Account
            </p>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Il tuo profilo
            </h1>

            <p className="mt-3 text-white/60">
              Gestisci le informazioni del tuo account.
            </p>
          </div>

          <ProfiloForm
            username={user.username}
            email={user.email}
            emailVerified={user.emailVerified}
          />

        </div>
      </section>
    </main>
  );
}