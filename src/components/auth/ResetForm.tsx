"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MechaPanel from "@/components/cp-arena/MechaPanel";

const inputCls = "mecha-input";

export default function ResetForm() {
  // undefined = reading the URL, "" = no token, string = the reset token
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Read the token after mount (defer the state set so it isn't set in the
  // effect body, and so there's no server/client hydration mismatch).
  useEffect(() => {
    const id = setTimeout(() => {
      const t = new URLSearchParams(window.location.search).get("token");
      setToken(t ?? "");
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Reset failed.");
        setLoading(false);
        return;
      }
      setDone(true);
      setTimeout(() => {
        window.location.href = "/login";
      }, 1400);
    } catch {
      setError("Couldn't reach the server.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <MechaPanel bodyClassName="p-8">
        {token === undefined ? (
          <p className="text-sm text-charcoal/60">Loading…</p>
        ) : token === "" ? (
          <>
            <h1 className="font-display text-2xl font-bold text-chocolate">
              Invalid reset link
            </h1>
            <p className="mt-2 text-sm text-charcoal/70">
              This link is missing its token. Request a fresh one.
            </p>
            <Link
              href="/forgot"
              className="mt-5 inline-block rounded-lg bg-bronze px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-bronze/90"
            >
              Request a new link
            </Link>
          </>
        ) : done ? (
          <>
            <h1 className="font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              Password updated
            </h1>
            <p className="mt-2 text-sm text-charcoal/70">
              Taking you to the log-in page…
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold text-chocolate">
              Set a new password
            </h1>
            <p className="mt-1 text-sm text-charcoal/60">
              Choose a new password for your account.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-xs font-medium text-charcoal/70"
                >
                  New password
                  <span className="ml-1 font-normal text-charcoal/45">
                    · at least 8 characters
                  </span>
                </label>
                <input
                  id="password"
                  type="password"
                  className={inputCls}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="confirm"
                  className="mb-1 block text-xs font-medium text-charcoal/70"
                >
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  className={inputCls}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="mecha-btn mecha-btn--solid w-full"
              >
                {loading ? "Updating…" : "Update password"}
              </button>
            </form>
          </>
        )}
      </MechaPanel>
    </div>
  );
}
