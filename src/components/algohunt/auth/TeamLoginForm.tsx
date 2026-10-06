"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function TeamLoginForm() {
  const router = useRouter();
  const [teamCode, setTeamCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/algohunt/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamCode, password }),
      });
      const body = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) {
        setError(body.error ?? "Could not log in. Please try again.");
        return;
      }
      router.replace("/algohunt");
      router.refresh();
    } catch {
      setError("Could not connect. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="ah-team-code" className="block text-sm font-medium">Team code</label>
        <input
          id="ah-team-code"
          className="mecha-input w-full"
          value={teamCode}
          onChange={(event) => setTeamCode(event.target.value)}
          placeholder="AH2-T014"
          autoCapitalize="characters"
          autoComplete="username"
          required
          minLength={3}
          maxLength={20}
          disabled={busy}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="ah-team-password" className="block text-sm font-medium">Password</label>
        <div className="flex gap-2">
          <input
            id="ah-team-password"
            className="mecha-input min-w-0 flex-1"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            minLength={4}
            maxLength={64}
            disabled={busy}
          />
          <button
            className="mecha-btn mecha-btn--ghost"
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}
            disabled={busy}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button className="mecha-btn mecha-btn--solid w-full" type="submit" disabled={busy}>
        {busy ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
