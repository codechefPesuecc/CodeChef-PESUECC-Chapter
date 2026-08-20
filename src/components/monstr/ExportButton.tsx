"use client";

import { useState } from "react";

interface Props {
  contestId: string;
  contestTitle: string;
  isEnded: boolean;
}

export default function ExportButton({ contestId, contestTitle, isEnded }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleExport = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/monstr/contests/${contestId}/export`);
      if (!res.ok) {
        setError("Failed to export results.");
        return;
      }

      // Download the file
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${contestTitle.replace(/\s+/g, "-")}-results.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("An error occurred. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mecha-wrapper space-y-3">
      <h2 className="text-lg font-semibold">Export Results</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={handleExport}
        disabled={loading}
        className="mecha-btn mecha-btn--solid w-full"
      >
        {loading ? "Exporting..." : "Download Excel Results"}
      </button>
      <p className="text-xs text-charcoal/60">
        Export includes all participants, SRN, problems solved, and per-problem verdict details.
      </p>
    </div>
  );
}
