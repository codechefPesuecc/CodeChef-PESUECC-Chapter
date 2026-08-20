"use client";

import { use, useTransition } from "react";
import { useRouter } from "next/navigation";
import ArenaRules from "@/components/cp-arena/ArenaRules";
import { setConsentCookie } from "./actions";

export default function ConsentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const router = useRouter();
  const { slug } = use(params);
  const [isPending, startTransition] = useTransition();

  const handleAgree = () => {
    startTransition(async () => {
      await setConsentCookie(slug);
      router.push(`/cp-arena/solve/${slug}`);
    });
  };

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-4xl px-6 pt-12 pb-24">
        <h1 className="font-display text-3xl font-bold tracking-tight text-chocolate sm:text-4xl">
          Arena Rules & Consent
        </h1>
        <p className="mt-4 max-w-2xl text-charcoal/70">
          The Problem of the Day is a ranked challenge with strict proctoring rules. 
          Please read and acknowledge the rules before entering the arena.
          Your solve timer will start exactly when you click &quot;I Agree &amp; Enter&quot;.
        </p>
        
        <div className="mt-8">
          <ArenaRules defaultOpen />
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <button
            onClick={() => router.push("/cp-arena")}
            className="mecha-btn mecha-btn--ghost"
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            onClick={handleAgree}
            disabled={isPending}
            className="initiative-btn relative"
          >
            {isPending ? "Entering..." : "I Agree & Enter"}
          </button>
        </div>
      </section>
    </main>
  );
}
