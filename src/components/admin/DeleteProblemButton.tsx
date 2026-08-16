"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Deletes a problem after an explicit confirm. Submissions aren't cascaded, but the
 * aggregate boards inner-join challenges, so a deleted problem's recorded solves drop
 * out of everyone's month/all-time totals — the confirm says so. Deleting the current
 * Problem of the Day makes the previous problem live again, which is also flagged.
 */
export default function DeleteProblemButton({
  slug,
  title,
  isDaily,
}: {
  slug: string;
  title: string;
  isDaily: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    let warn = `Delete "${title}"?\n\nThe problem is removed and its recorded solves drop out of the month and all-time leaderboards.`;
    if (isDaily) {
      warn +=
        "\n\nThis is the CURRENT Problem of the Day — deleting it makes the previous released problem today's POTD.";
    }
    if (!window.confirm(warn)) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/problems/${slug}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        window.alert(d.error ?? "Delete failed.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      window.alert("Network error — try again.");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      className="font-mono text-[11px] uppercase tracking-wider text-red-600/80 hover:underline disabled:opacity-50 dark:text-red-400/80"
    >
      {busy ? "…" : "Delete"}
    </button>
  );
}
