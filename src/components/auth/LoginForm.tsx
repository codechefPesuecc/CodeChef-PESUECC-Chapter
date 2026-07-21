"use client";

import { useState } from "react";
import Link from "next/link";

const inputCls =
  "w-full rounded-lg border border-hairline bg-cream/40 px-3 py-2.5 text-sm text-charcoal outline-none transition-colors focus:border-bronze dark:bg-white/[0.03]";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Login failed.");
        setLoading(false);
        return;
      }
      window.location.href = "/cp-arena";
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-hairline bg-panel p-8 shadow-sm">
        <h1 className="font-display text-2xl font-bold text-chocolate">Log in</h1>
        <p className="mt-1 text-sm text-charcoal/60">
          Welcome back to the Arena.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="username"
              className="mb-1 block text-xs font-medium text-charcoal/70"
            >
              Username
            </label>
            <input
              id="username"
              className={inputCls}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-xs font-medium text-charcoal/70"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-charcoal/60">
          New here?{" "}
          <Link href="/register" className="font-semibold text-bronze hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
