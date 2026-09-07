"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputCls = "mecha-input";

export interface ProfileEditValues {
  name: string | null;
  username: string;
  srn: string | null;
  prn: string;
}

/**
 * The editable half of the profile's Identity panel. Collapsed to a read-only
 * summary by default; "Edit details" swaps in the form. Email is rendered by the
 * page itself and stays read-only (it drives the OTP verification flow).
 */
export default function ProfileEditForm({ user }: { user: ProfileEditValues }) {
  const router = useRouter();
  const initial = {
    name: user.name ?? "",
    username: user.username,
    srn: user.srn ?? "",
    prn: user.prn,
  };

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set =
    (key: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  function cancel() {
    setForm(initial);
    setError(null);
    setOpen(false);
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Couldn't save your changes.");
        return;
      }
      setOpen(false);
      // Re-render the server component so the header, stats and board rank all
      // pick up the new values.
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 px-5 pb-4 text-sm">
        <DetailRow label="Name">
          <span className="text-charcoal/80">{user.name ?? "—"}</span>
        </DetailRow>
        <DetailRow label="PRN">
          <span className="font-mono text-charcoal/80">{user.prn}</span>
        </DetailRow>
        <DetailRow label="SRN">
          <span className="font-mono text-charcoal/80">{user.srn ?? "—"}</span>
        </DetailRow>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mecha-btn mecha-btn--ghost mecha-btn--sm ml-auto"
        >
          Edit details
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 px-5 pb-5">
      <Field label="Name">
        <input
          className={inputCls}
          value={form.name}
          onChange={set("name")}
          autoComplete="name"
          required
        />
      </Field>
      <Field label="Username" hint="Your handle on the leaderboard — also your login.">
        <input
          className={inputCls}
          value={form.username}
          onChange={set("username")}
          autoComplete="username"
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="PRN">
          <input className={inputCls} value={form.prn} onChange={set("prn")} required />
        </Field>
        <Field label="SRN" hint="Optional">
          <input className={inputCls} value={form.srn} onChange={set("srn")} />
        </Field>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="mecha-btn mecha-btn--solid mecha-btn--sm"
        >
          {loading ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={loading}
          className="mecha-btn mecha-btn--ghost mecha-btn--sm"
        >
          Cancel
        </button>
      </div>
    </form>
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
        {hint && <span className="ml-2 font-normal text-charcoal/45">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-0.5 block font-mono text-[11px] uppercase tracking-wider text-charcoal/45">
        {label}
      </span>
      <span className="flex items-center">{children}</span>
    </div>
  );
}
