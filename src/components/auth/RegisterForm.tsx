"use client";

import { useState } from "react";
import Link from "next/link";
import MechaPanel from "@/components/cp-arena/MechaPanel";

const inputCls = "mecha-input";

const empty = { username: "", email: "", prn: "", srn: "", password: "", confirm: "" };

export default function RegisterForm() {
  const [form, setForm] = useState(empty);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set =
    (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (!agree) {
      setError("Please accept the arena rules to continue.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          prn: form.prn,
          srn: form.srn || undefined,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Registration failed.");
        setLoading(false);
        return;
      }
      window.location.href = data.needsVerify ? "/verify" : "/cp-arena";
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-12">
      <MechaPanel bodyClassName="p-8">
        <h1 className="font-display text-2xl font-bold text-chocolate">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-charcoal/60">
          Join the Arena and climb the daily leaderboard.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Username" hint="Your public name on the leaderboard.">
            <input
              className={inputCls}
              value={form.username}
              onChange={set("username")}
              autoComplete="username"
              required
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className={inputCls}
              value={form.email}
              onChange={set("email")}
              autoComplete="email"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="PRN">
              <input
                className={inputCls}
                value={form.prn}
                onChange={set("prn")}
                required
              />
            </Field>
            <Field label="SRN" hint="Optional — add later.">
              <input className={inputCls} value={form.srn} onChange={set("srn")} />
            </Field>
          </div>
          <Field label="Password" hint="At least 8 characters.">
            <input
              type="password"
              className={inputCls}
              value={form.password}
              onChange={set("password")}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="Confirm password">
            <input
              type="password"
              className={inputCls}
              value={form.confirm}
              onChange={set("confirm")}
              autoComplete="new-password"
              required
            />
          </Field>
          <label className="flex items-start gap-2 text-xs text-charcoal/70">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 accent-bronze"
            />
            <span>
              I agree to the Arena fair-play rules — no plagiarism, sharing, or
              automating submissions.
            </span>
          </label>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mecha-btn mecha-btn--solid w-full"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-charcoal/60">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-bronze hover:underline">
            Log in
          </Link>
        </p>
      </MechaPanel>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-charcoal/70">
        {label}
        {hint && <span className="ml-1 font-normal text-charcoal/45">· {hint}</span>}
      </label>
      {children}
    </div>
  );
}
