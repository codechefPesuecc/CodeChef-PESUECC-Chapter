"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Info,
  KeyRound,
  Loader2,
  Lock,
} from "lucide-react";
import Link from "@/components/AppLink";
import MechaPanel from "@/components/cp-arena/MechaPanel";
import { formatCodeForDisplay, normalizeCode } from "@/lib/algohunt/codes";
import { COPY } from "@/lib/algohunt/copy";
import type { RedeemResult, StageState } from "@/lib/algohunt/types";

export interface CodeEntryProps {
  teamCode: string;
  stageNumber: number; // current question
  isFinal: boolean;
  state: StageState; // from ParticipantState.current.state
  canPlay: boolean; // false when paused/ended/not checked in
  disabledReason?: string;
  onResult?: (r: RedeemResult) => void;
}

type ResultDisplay =
  | { kind: "UNLOCKED"; message: string; nextQuestion: number }
  | { kind: "ALREADY_UNLOCKED"; message: string; nextQuestion: number }
  | { kind: "ALREADY_USED"; message: string }
  | { kind: "INVALID"; message: string; attemptsLeft: number | null }
  | { kind: "NOT_SOLVED"; message: string }
  | { kind: "COOLDOWN"; message: string }
  | { kind: "NETWORK_ERROR"; message: string };

export default function CodeEntry({
  teamCode,
  stageNumber,
  isFinal,
  state,
  canPlay,
  disabledReason,
  onResult,
}: CodeEntryProps) {
  const storageKey = `ah:code:${teamCode}:${stageNumber}`;

  const [rawCode, setRawCode] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(storageKey) ?? "";
    } catch {
      return "";
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ResultDisplay | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null);

  // Live countdown timer for COOLDOWN
  useEffect(() => {
    if (cooldownSeconds === null || cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const saveToStorage = (val: string) => {
    try {
      localStorage.setItem(storageKey, val);
    } catch {
      // ignore
    }
  };

  const clearStorage = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  };

  const handleInputChange = (val: string) => {
    setRawCode(val);
    saveToStorage(val);
  };

  // State flags
  const isCodePending = state === "CODE_PENDING";
  const isSolved = isCodePending;
  const isCooldown = cooldownSeconds !== null && cooldownSeconds > 0;
  const normalized = normalizeCode(rawCode);
  const preview = normalized ? formatCodeForDisplay(normalized) : "";

  // Final question check
  if (isFinal) {
    return (
      <MechaPanel label="CODE ENTRY" index={`Q${stageNumber}`}>
        <div className="p-5 sm:p-7">
          <div className="lc-panel p-5 text-center space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-bronze/10 text-bronze mx-auto">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="font-display text-lg font-bold">Final Question</h3>
            <p className="text-sm text-charcoal/80 max-w-md mx-auto">
              No code needed for the final question. Solve it to finish AlgoHunt 2.0!
            </p>
            <div className="pt-2">
              <Link href="/algohunt/challenge" className="mecha-btn mecha-btn--solid inline-flex items-center gap-2">
                <span>Go to Question {stageNumber}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </MechaPanel>
    );
  }

  const unlockDisabled =
    submitting ||
    isCooldown ||
    !canPlay ||
    !isSolved ||
    normalized.length === 0;

  async function handleUnlock(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (unlockDisabled) return;

    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/algohunt/codes/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: rawCode }),
      });

      const data = await res.json();

      if (data.ok) {
        const r = data as RedeemResult;
        if (r.result === "UNLOCKED") {
          clearStorage();
          setRawCode("");
          setResult({
            kind: "UNLOCKED",
            message: r.message,
            nextQuestion: r.unlockedStageNumber ?? stageNumber + 1,
          });
          onResult?.(r);
        } else if (r.result === "ALREADY_UNLOCKED") {
          clearStorage();
          setRawCode("");
          setResult({
            kind: "ALREADY_UNLOCKED",
            message: r.message,
            nextQuestion: r.unlockedStageNumber ?? stageNumber + 1,
          });
          onResult?.(r);
        } else if (r.result === "ALREADY_USED") {
          clearStorage();
          setRawCode("");
          setResult({
            kind: "ALREADY_USED",
            message: r.message ?? COPY.alreadyUsed,
          });
          onResult?.(r);
        } else if (r.result === "INVALID") {
          setResult({
            kind: "INVALID",
            message: r.message ?? COPY.invalidCode,
            attemptsLeft: r.invalidAttemptsLeft ?? null,
          });
          onResult?.(r);
        }
      } else {
        if (data.code === "COOLDOWN") {
          const seconds = typeof data.retryAfterSeconds === "number" ? data.retryAfterSeconds : 60;
          setCooldownSeconds(seconds);
          setResult({
            kind: "COOLDOWN",
            message: data.error ?? COPY.cooldown.replace("{s}", String(seconds)),
          });
        } else if (data.code === "CHALLENGE_NOT_SOLVED") {
          setResult({
            kind: "NOT_SOLVED",
            message: data.error ?? COPY.notSolved,
          });
        } else {
          setResult({
            kind: "INVALID",
            message: data.error ?? COPY.invalidCode,
            attemptsLeft: null,
          });
        }
      }
    } catch {
      setResult({
        kind: "NETWORK_ERROR",
        message: "Connection problem. Your code is saved; tap Unlock to retry.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MechaPanel label="CODE ENTRY" index={`Q${stageNumber}`}>
      <div className="p-5 sm:p-7 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-bronze" />
            <h2 className="font-display text-xl font-bold sm:text-2xl text-charcoal">
              Found a QR? Enter its code
            </h2>
          </div>
          <p className="mt-1 text-sm text-charcoal/70">
            Each code works once, for the first team that uses it.
          </p>
        </div>

        {/* State Banner if not solved */}
        {!isSolved && (
          <div className="rounded-md border border-amber-300/60 bg-amber-50/70 p-3 text-xs sm:text-sm text-amber-900 flex items-start gap-2.5">
            <Lock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Question not solved yet. </span>
              {COPY.notSolved}
            </div>
          </div>
        )}

        {/* Can Play Disabled Reason */}
        {!canPlay && disabledReason && (
          <div className="rounded-md border border-neutral-300 bg-neutral-100 p-3 text-xs sm:text-sm text-neutral-700 flex items-start gap-2.5">
            <Lock className="h-4 w-4 text-neutral-500 shrink-0 mt-0.5" />
            <div>{disabledReason}</div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="algohunt-code-input"
              className="block font-mono text-xs font-semibold uppercase tracking-wider text-charcoal/70"
            >
              8-Character Code
            </label>
            <div className="relative">
              <input
                id="algohunt-code-input"
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={16}
                disabled={isCooldown}
                value={rawCode}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="7FQ2-M8K3"
                className="w-full rounded-md border border-chocolate/20 bg-cream/30 px-4 py-3 font-mono text-xl sm:text-2xl font-bold tracking-[0.25em] uppercase text-charcoal placeholder:text-charcoal/25 focus:border-bronze focus:bg-white focus:outline-none focus:ring-1 focus:ring-bronze disabled:bg-neutral-100 disabled:text-neutral-400 transition"
              />
            </div>

            {/* Live formatting preview */}
            {preview && preview !== rawCode && (
              <div className="flex items-center gap-2 text-xs text-charcoal/60 font-mono">
                <span>Formatted:</span>
                <span className="font-semibold text-charcoal tracking-wider">{preview}</span>
              </div>
            )}
          </div>

          {/* Action button */}
          <div>
            <button
              type="submit"
              disabled={unlockDisabled}
              className="mecha-btn mecha-btn--solid w-full flex items-center justify-center gap-2 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Checking code...</span>
                </>
              ) : isCooldown ? (
                <>
                  <Clock className="h-4 w-4" />
                  <span>Cooldown active ({cooldownSeconds}s)</span>
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  <span>Unlock Question {stageNumber + 1}</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Result Feedback Area */}
        <div role="status" aria-live="polite">
          {result?.kind === "UNLOCKED" && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm font-medium text-emerald-900">
                  {result.message}
                </div>
              </div>
              <div>
                <Link
                  href="/algohunt/challenge"
                  className="mecha-btn mecha-btn--solid bg-emerald-700 hover:bg-emerald-800 text-white w-full flex items-center justify-center gap-2 text-sm"
                >
                  <span>Go to Question {result.nextQuestion}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}

          {result?.kind === "ALREADY_UNLOCKED" && (
            <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm font-medium text-blue-900">
                  {result.message}
                </div>
              </div>
              <div>
                <Link
                  href="/algohunt/challenge"
                  className="mecha-btn mecha-btn--solid bg-blue-700 hover:bg-blue-800 text-white w-full flex items-center justify-center gap-2 text-sm"
                >
                  <span>Go to Question {result.nextQuestion}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}

          {result?.kind === "ALREADY_USED" && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm font-medium text-amber-900">
                {result.message}
              </div>
            </div>
          )}

          {result?.kind === "INVALID" && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 space-y-1">
              <div className="flex items-start gap-2.5 text-sm font-medium text-rose-900">
                <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                <span>{result.message}</span>
              </div>
              {result.attemptsLeft !== null && result.attemptsLeft <= 2 && (
                <p className="text-xs text-rose-700 pl-7">
                  {result.attemptsLeft} more wrong {result.attemptsLeft === 1 ? "code" : "codes"} before a short pause
                </p>
              )}
            </div>
          )}

          {result?.kind === "COOLDOWN" && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 flex items-start gap-3">
              <Clock className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-sm font-medium text-rose-900">
                {cooldownSeconds !== null
                  ? COPY.cooldown.replace("{s}", String(cooldownSeconds))
                  : result.message}
              </div>
            </div>
          )}

          {result?.kind === "NOT_SOLVED" && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
              <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm font-medium text-amber-900">
                {result.message}
              </div>
            </div>
          )}

          {result?.kind === "NETWORK_ERROR" && (
            <div className="rounded-lg border border-neutral-300 bg-neutral-100 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-neutral-600 shrink-0 mt-0.5" />
              <div className="text-sm font-medium text-neutral-900">
                {result.message}
              </div>
            </div>
          )}
        </div>

        {/* Footer tip */}
        <div className="border-t border-chocolate/10 pt-3 text-center">
          <p className="text-xs text-charcoal/60">
            Tip: you&apos;re allowed to tear a QR after scanning it.
          </p>
        </div>
      </div>
    </MechaPanel>
  );
}
