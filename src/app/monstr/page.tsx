import { getCurrentUser } from "@/server/auth/session";
import JoinForm from "@/components/monstr/JoinForm";

export const dynamic = "force-dynamic";

export default async function MonstrPage() {
  const user = await getCurrentUser();

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-md px-6 py-12">
        <div className="text-center mb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-bronze mb-2">
            Monstr
          </p>
          <h1 className="font-display text-3xl font-bold text-chocolate mb-2">
            Join a Contest
          </h1>
          <p className="text-sm text-charcoal/60">
            Enter a join code or scan a QR code to participate
          </p>
        </div>

        {user && user.emailVerified && user.srn ? (
          <JoinForm />
        ) : (
          <div className="mecha-wrapper space-y-4">
            <p className="text-sm text-charcoal/70">
              {!user
                ? "Sign in to join a contest."
                : !user.emailVerified
                  ? "Verify your email before joining."
                  : "Add your SRN in your profile before joining."}
            </p>
            <a
              href={!user ? "/login" : "/profile"}
              className="mecha-btn mecha-btn--solid block text-center"
            >
              {!user ? "Sign in" : "Go to profile"}
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
