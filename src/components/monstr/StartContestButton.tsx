"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  contestId: string;
  isStarted: boolean;
}

export default function StartContestButton({ contestId, isStarted }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStart = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/monstr/contests/${contestId}/start`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to start contest.");
        return;
      }

      router.refresh();
    } catch {
      setError("An error occurred. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (isStarted) {
    return (
      <div className="p-4 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded">
        <p className="text-green-800 dark:text-green-300 font-medium">
          ✓ Contest is now active
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-charcoal/70 mb-3">
        Students can join the contest anytime, but the timer begins when you click Start.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={handleStart}
        disabled={loading}
        className="mecha-btn mecha-btn--solid w-full"
      >
        {loading ? "Starting..." : "Start Contest"}
      </button>
    </div>
  );
}
