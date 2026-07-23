"use client";

import { useState } from "react";
import Link from "next/link";
import MechaPanel from "@/components/cp-arena/MechaPanel";

const inputCls =
  "w-full rounded-lg border border-hairline bg-cream/40 px-3 py-2.5 text-sm text-charcoal outline-none transition-colors focus:border-bronze dark:bg-white/[0.03]";

export default function ForgotForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }
      setSent(true);
      if (data.devLink) setDevLink(data.devLink);
    } catch {
      setError("Couldn't reach the server.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <MechaPanel bodyClassName="p-8">
        <h1 className="font-display text-2xl font-bold text-chocolate">
          Reset your password
        </h1>
        {sent ? (
          <>
            <p className="mt-2 text-sm text-charcoal/70">
              If an account exists for that email, we&apos;ve sent a reset link.
              It&apos;s valid for 30 minutes.
            </p>
            {devLink && (
              <p className="mt-4 break-all rounded-lg border border-dashed border-bronze/40 bg-bronze/5 px-3 py-2 text-xs text-charcoal/70">
                Dev mode — reset link:{" "}
                <Link href={devLink.replace(/^https?:\/\/[^/]+/, "")} className="font-mono font-semibold text-bronze hover:underline">
                  {devLink}
                </Link>
              </p>
            )}
            <Link
              href="/login"
              className="mt-5 inline-block text-sm font-semibold text-bronze hover:underline"
            >
              ← Back to log in
            </Link>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-charcoal/60">
              Enter your email and we&apos;ll send you a link to set a new
              password.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-xs font-medium text-charcoal/70"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className={inputCls}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-bronze px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-bronze/90 disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p className="mt-5 text-center text-sm text-charcoal/60">
              Remembered it?{" "}
              <Link href="/login" className="font-semibold text-bronze hover:underline">
                Log in
              </Link>
            </p>
          </>
        )}
      </MechaPanel>
    </div>
  );
}
