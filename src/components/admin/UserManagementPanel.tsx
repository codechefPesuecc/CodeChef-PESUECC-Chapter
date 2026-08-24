"use client";

import { useState } from "react";

export interface UserRow {
  id: string;
  username: string;
  name: string | null;
  email: string;
  prn: string;
  srn: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  createdAt: number;
}

const EMPTY_NEW = {
  username: "",
  name: "",
  email: "",
  prn: "",
  srn: "",
  password: "",
  isAdmin: false,
  isTeacher: false,
};

export default function UserManagementPanel({
  initialUsers,
  currentAdminId,
}: {
  initialUsers: UserRow[];
  currentAdminId: string;
}) {
  const [rows, setRows] = useState<UserRow[]>(initialUsers);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_NEW });
  const [adding, setAdding] = useState(false);

  async function reload(query = q) {
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query.trim())}`);
    const data = await res.json();
    if (data.ok) setRows(data.users as UserRow[]);
  }

  async function toggleRole(u: UserRow, key: "isAdmin" | "isTeacher") {
    setBusyId(u.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: !u[key] }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error ?? "Failed.");
      else await reload();
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(u: UserRow) {
    if (!confirm(`Permanently delete @${u.username} and all their data? This cannot be undone.`))
      return;
    setBusyId(u.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) setError(data.error ?? "Failed.");
      else setRows((r) => r.filter((x) => x.id !== u.id));
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Failed to create user.");
        return;
      }
      setForm({ ...EMPTY_NEW });
      setShowAdd(false);
      await reload("");
      setQ("");
    } catch {
      setError("Network error.");
    } finally {
      setAdding(false);
    }
  }

  const inputCls =
    "w-full rounded border border-hairline bg-white/70 px-3 py-2 text-sm text-chocolate dark:bg-panel/70";

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            reload(e.target.value);
          }}
          placeholder="Search username / name / email / PRN / SRN…"
          className={`${inputCls} max-w-sm`}
        />
        <span className="text-xs text-charcoal/50">{rows.length} shown</span>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="mecha-btn mecha-btn--solid ml-auto"
        >
          {showAdd ? "Cancel" : "+ Add user"}
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={addUser}
          className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-hairline bg-white/60 p-5 sm:grid-cols-2 dark:bg-panel/60"
        >
          <label className="text-xs text-charcoal/60">
            Username *
            <input
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="text-xs text-charcoal/60">
            Full name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="text-xs text-charcoal/60">
            Email *
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="text-xs text-charcoal/60">
            Password * (min 8)
            <input
              required
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="text-xs text-charcoal/60">
            PRN *
            <input
              required
              value={form.prn}
              onChange={(e) => setForm({ ...form, prn: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="text-xs text-charcoal/60">
            SRN
            <input
              value={form.srn}
              onChange={(e) => setForm({ ...form, srn: e.target.value })}
              className={inputCls}
            />
          </label>
          <div className="col-span-full flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-charcoal/70">
              <input
                type="checkbox"
                checked={form.isTeacher}
                onChange={(e) => setForm({ ...form, isTeacher: e.target.checked })}
              />
              Teacher
            </label>
            <label className="flex items-center gap-2 text-sm text-charcoal/70">
              <input
                type="checkbox"
                checked={form.isAdmin}
                onChange={(e) => setForm({ ...form, isAdmin: e.target.checked })}
              />
              Admin
            </label>
            <button type="submit" disabled={adding} className="mecha-btn mecha-btn--solid ml-auto">
              {adding ? "Creating…" : "Create user"}
            </button>
          </div>
          <p className="col-span-full text-[11px] text-charcoal/45">
            Admin-created accounts skip email verification. Share the password securely; the
            user can change it via forgot-password.
          </p>
        </form>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-hairline bg-white/60 shadow-sm dark:bg-panel/60">
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-charcoal/60">No users match.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left font-mono text-[11px] uppercase tracking-wider text-charcoal/45">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">PRN / SRN</th>
                <th className="px-4 py-3 font-medium">Roles</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((u) => {
                const isSelf = u.id === currentAdminId;
                const busy = busyId === u.id;
                return (
                  <tr key={u.id} className="hover:bg-cream/40 dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-chocolate">
                        {u.name || u.username}
                        {isSelf && <span className="ml-2 text-[11px] text-bronze">(you)</span>}
                      </div>
                      <div className="font-mono text-[11px] text-charcoal/45">
                        @{u.username} · {u.email}
                        {!u.emailVerified && <span className="ml-1 text-amber-600">· unverified</span>}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 font-mono text-xs text-charcoal/60 sm:table-cell">
                      {u.prn}
                      {u.srn ? ` · ${u.srn}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busy || (isSelf && u.isAdmin)}
                          onClick={() => toggleRole(u, "isAdmin")}
                          title={isSelf ? "You can't change your own admin access" : ""}
                          className={`mecha-chip ${
                            u.isAdmin
                              ? "bg-bronze/20 text-bronze"
                              : "bg-black/5 text-charcoal/50 dark:bg-white/5"
                          } disabled:opacity-50`}
                        >
                          Admin {u.isAdmin ? "✓" : ""}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => toggleRole(u, "isTeacher")}
                          className={`mecha-chip ${
                            u.isTeacher
                              ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                              : "bg-black/5 text-charcoal/50 dark:bg-white/5"
                          } disabled:opacity-50`}
                        >
                          Teacher {u.isTeacher ? "✓" : ""}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={busy || isSelf}
                        onClick={() => remove(u)}
                        title={isSelf ? "You can't delete your own account" : ""}
                        className="font-mono text-[11px] uppercase tracking-wider text-red-600 hover:underline disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
