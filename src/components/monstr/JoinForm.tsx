"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = useCallback(async (codeToSubmit?: string) => {
    const submitCode = codeToSubmit || code;
    if (!submitCode.trim()) {
      setError("Join code is required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/monstr/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: submitCode }),
      });

      if (res.status === 401) {
        // Not logged in — store code and redirect
        sessionStorage.setItem("monstr_pending_code", submitCode);
        router.push("/login");
        return;
      }

      if (res.status === 403) {
        const data = await res.json();
        if (data.needsVerify) {
          setError("Verify your email before joining.");
          return;
        }
        if (data.needsSrn) {
          setError("Add your SRN in your profile before joining.");
          return;
        }
        setError("You are not authorized to join this contest.");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to join contest.");
        return;
      }

      const data = await res.json();
      router.push(`/monstr/contest/${data.contestId}`);
    } catch {
      setError("An error occurred. Try again.");
    } finally {
      setLoading(false);
    }
  }, [code, router]);

  // On mount, check for ?code= and auto-submit
  useEffect(() => {
    const queryCode = searchParams.get("code");
    const storedCode = typeof window !== "undefined" ? sessionStorage.getItem("monstr_pending_code") : null;
    const codeToUse = queryCode || storedCode;

    if (codeToUse) {
      sessionStorage.removeItem("monstr_pending_code");
      const timer = setTimeout(() => {
        setCode(codeToUse);
        void handleSubmit(codeToUse);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams, handleSubmit]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="mecha-wrapper space-y-4"
    >
      <div>
        <label htmlFor="code" className="block text-sm font-medium mb-2">
          Join Code
        </label>
        <input
          id="code"
          type="text"
          placeholder="e.g., A3K9M2"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError("");
          }}
          disabled={loading}
          className="mecha-input w-full"
        />
        <p className="text-xs text-charcoal/50 mt-1">
          6-character code from your teacher
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || !code.trim()}
        className="mecha-btn mecha-btn--solid w-full"
      >
        {loading ? "Joining..." : "Join Contest"}
      </button>
    </form>
  );
}
