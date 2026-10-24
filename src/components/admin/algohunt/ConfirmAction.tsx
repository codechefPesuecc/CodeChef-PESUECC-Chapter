"use client";

import { useEffect, useId, useRef, useState } from "react";

export const REASON_MIN_CHARS = 5;
export const REASON_MAX_CHARS = 500;

function reasonLength(reason: string): number {
  return reason.trim().length;
}

/** Confirm needs the exact phrase (no trimming, no case folding) and, when asked for, a 5 to 500 character reason. */
export function canConfirm(p: { phrase: string; typed: string; requireReason: boolean; reason: string }): boolean {
  if (p.phrase.length === 0 || p.typed !== p.phrase) return false;
  if (!p.requireReason) return true;
  const length = reasonLength(p.reason);
  return length >= REASON_MIN_CHARS && length <= REASON_MAX_CHARS;
}

export interface ConfirmActionProps {
  open: boolean;
  title: string;
  /** Plain-language effect, e.g. "Unlocks Question 5 for Binary Bandits immediately…" */
  consequences: string;
  /** Exact text the admin must type (team code or event slug). */
  confirmPhrase: string;
  /** Shows a reason box (5 to 500 characters). */
  requireReason?: boolean;
  confirmLabel?: string;
  danger?: boolean;
  /**
   * Runs once the phrase (and reason) are valid. A thrown error is shown inside the dialog and
   * the dialog stays open. When it resolves, the dialog calls onClose.
   */
  onConfirm: (p: { reason?: string; confirm: string }) => Promise<void> | void;
  onClose: () => void;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Typed-confirmation dialog for every dangerous admin action. The server re-checks the phrase and
 * the reason, so this is a guard against slips, not a security boundary.
 */
export default function ConfirmAction(props: ConfirmActionProps) {
  // Mounting only while open gives every opening a fresh form, with no state to reset.
  if (!props.open) return null;
  return <ConfirmDialog {...props} />;
}

function ConfirmDialog({
  title, consequences, confirmPhrase, requireReason = false,
  confirmLabel = "Confirm", danger = false, onConfirm, onClose,
}: ConfirmActionProps) {
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const phraseRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descId = `${baseId}-desc`;
  const phraseId = `${baseId}-phrase`;
  const reasonId = `${baseId}-reason`;

  const ready = canConfirm({ phrase: confirmPhrase, typed, requireReason, reason });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    phraseRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (!busy) onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm({ reason: requireReason ? reason.trim() : undefined, confirm: typed });
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="my-auto w-full max-w-md rounded-2xl border border-hairline bg-panel p-6 shadow-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h2
              id={titleId}
              className={`font-display text-lg font-bold ${danger ? "text-red-600 dark:text-red-400" : "text-chocolate"}`}
            >
              {title}
            </h2>
            <p id={descId} className="mt-2 whitespace-pre-line text-sm text-charcoal/80">{consequences}</p>
          </div>

          {requireReason && (
            <div>
              <label htmlFor={reasonId} className="font-mono text-[11px] uppercase tracking-wider text-bronze">
                Reason ({REASON_MIN_CHARS} to {REASON_MAX_CHARS} characters)
              </label>
              <textarea
                id={reasonId}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={REASON_MAX_CHARS + 100}
                disabled={busy}
                className="mecha-input mt-1 resize-y"
              />
              <p className="mt-1 text-right font-mono text-[11px] text-charcoal/50">
                {reasonLength(reason)} / {REASON_MAX_CHARS}
              </p>
            </div>
          )}

          <div>
            <label htmlFor={phraseId} className="font-mono text-[11px] uppercase tracking-wider text-bronze">
              Type <code className="rounded bg-hairline/50 px-1 py-0.5 text-chocolate normal-case">{confirmPhrase}</code> to confirm
            </label>
            <input
              id={phraseId}
              ref={phraseRef}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={busy}
              className="mecha-input mt-1 font-mono"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex flex-wrap justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={busy} className="mecha-btn mecha-btn--ghost mecha-btn--sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!ready || busy}
              className={`mecha-btn mecha-btn--sm text-white ${danger ? "bg-red-600 hover:bg-red-700" : "mecha-btn--solid"}`}
            >
              {busy ? "Working…" : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
