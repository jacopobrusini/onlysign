import Header from "@/components/Header";
import { getSession } from "@/lib/session";
import DeleteAccountForm from "./DeleteAccountForm";

export default async function DeleteAccountPage() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <Header />

      <section className="px-6 pb-16 pt-28">
        <div className="mx-auto max-w-2xl">
          <div className="mb-10">
            <p className="mb-2 text-sm uppercase tracking-[0.3em] text-red-300/70">
              Account
            </p>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Elimina account
            </h1>

            <p className="mt-3 text-white/60">
              L&apos;eliminazione dell&apos;account è permanente.
            </p>
          </div>

          <DeleteAccountForm
            email={session.user.email}
            emailVerified={session.user.emailVerified}
          />
        </div>
      </section>
    </main>
  );
}