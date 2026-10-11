"use client";

import { useState, useMemo, useRef } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import AppLink from "@/components/AppLink";
import { formatCodeForDisplay } from "@/lib/algohunt/codes";
import { formatIST } from "@/lib/algohunt/format";
import type {
  CodeAttemptResult,
  CodePoolStats,
  CodeStatus,
} from "@/lib/algohunt/types";
import { usePoll } from "@/components/algohunt/usePoll";
import ConfirmAction from "@/components/admin/algohunt/ConfirmAction";

export interface BatchItem {
  id: string;
  name: string;
  size: number;
  createdAt: number;
  active: number;
  used: number;
  disabled: number;
}

export interface CodeItem {
  id: string;
  serial: number;
  code: string;
  batchName: string;
  status: CodeStatus;
  usedByTeam: { code: string; name: string } | null;
  usedForStageNumber: number | null;
  usedAt: number | null;
  disabledReason: string | null;
  placementNote: string | null;
}

export interface AttemptItem {
  id: string;
  createdAt: number;
  teamCode: string;
  teamName: string;
  stageNumber: number | null;
  submittedCode: string | null;
  result: CodeAttemptResult;
  ip: string | null;
}

interface CodesResponse {
  ok: boolean;
  stats: CodePoolStats;
  batches: BatchItem[];
  codes: CodeItem[];
  nextCursor: number | null;
}

interface AttemptsResponse {
  ok: boolean;
  attempts: AttemptItem[];
}

const RESULT_CHIPS: Record<CodeAttemptResult, string> = {
  UNLOCKED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  ALREADY_UNLOCKED: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  ALREADY_USED: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  INVALID: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  NOT_SOLVED: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  COOLDOWN: "bg-red-500/20 text-red-800 dark:text-red-200 border-red-500/40 font-bold",
};

export default function CodesAdmin({ eventSlug }: { eventSlug: string }) {
  const [activeTab, setActiveTab] = useState<"codes" | "attempts">("codes");

  // Filter States for Codes
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [batchFilter, setBatchFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [revealedCodeIds, setRevealedCodeIds] = useState<Set<string>>(new Set());
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Additional loaded codes from "Load More"
  const [appendedCodes, setAppendedCodes] = useState<CodeItem[]>([]);
  const [cursorOverride, setCursorOverride] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Note editing state: codeId -> current note string
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});

  // Batch Generation Form State
  function defaultBatchName(): string {
    const timeStr = new Date().toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `Live batch ${timeStr}`;
  }

  const [batchName, setBatchName] = useState(defaultBatchName);
  const [batchSize, setBatchSize] = useState<number>(20);
  const [confirmGenerateOpen, setConfirmGenerateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [createdBatchAlert, setCreatedBatchAlert] = useState<{
    id: string;
    name: string;
    minSerial: number;
    maxSerial: number;
  } | null>(null);

  // Disable Batch Dialog State
  const [batchToDisable, setBatchToDisable] = useState<BatchItem | null>(null);
  const [disablingBatch, setDisablingBatch] = useState(false);

  // Code Enable/Disable Dialog State
  const [codeAvailabilityModal, setCodeAvailabilityModal] = useState<{
    code: CodeItem;
    action: "DISABLE" | "ENABLE";
  } | null>(null);
  const [availabilityReason, setAvailabilityReason] = useState("");
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  // Attempt Tab State
  const [attemptTeam, setAttemptTeam] = useState("");
  const [attemptResult, setAttemptResult] = useState<string>("ALL");
  const [suspiciousOnly, setSuspiciousOnly] = useState(false);

  // Handlers for filter changes that reset pagination safely
  function handleStatusChange(st: string) {
    setStatusFilter(st);
    setAppendedCodes([]);
    setCursorOverride(null);
  }

  function handleBatchChange(b: string) {
    setBatchFilter(b);
    setAppendedCodes([]);
    setCursorOverride(null);
  }

  function handleSearchChange(val: string) {
    setSearchQuery(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedQuery(val.trim());
      setAppendedCodes([]);
      setCursorOverride(null);
    }, 300);
  }

  // Construct URL for codes polling
  const codesUrl = useMemo(() => {
    const params = new URLSearchParams({ event: eventSlug });
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (batchFilter !== "ALL") params.set("batch", batchFilter);
    if (debouncedQuery) params.set("q", debouncedQuery);
    return `/api/admin/algohunt/codes?${params.toString()}`;
  }, [eventSlug, statusFilter, batchFilter, debouncedQuery]);

  const { data: pollData, error: pollError, refresh: refreshCodes } = usePoll<CodesResponse>(
    codesUrl,
    { intervalMs: 10000, jitterMs: 1000, enabled: activeTab === "codes" }
  );

  // Construct URL for attempts polling
  const attemptsUrl = useMemo(() => {
    const params = new URLSearchParams({ event: eventSlug });
    if (attemptTeam.trim()) params.set("team", attemptTeam.trim());
    if (attemptResult !== "ALL") params.set("result", attemptResult);
    if (suspiciousOnly) params.set("suspicious", "1");
    return `/api/admin/algohunt/code-attempts?${params.toString()}`;
  }, [eventSlug, attemptTeam, attemptResult, suspiciousOnly]);

  const { data: attemptsPollData, loading: loadingAttempts, refresh: refreshAttempts } = usePoll<AttemptsResponse>(
    attemptsUrl,
    { intervalMs: 10000, jitterMs: 1000, enabled: activeTab === "attempts" }
  );

  const stats = pollData?.stats;
  const batches = pollData?.batches ?? [];
  const attempts = attemptsPollData?.attempts ?? [];

  // Combined code items (first page from poll + any sequentially loaded pages)
  const allCodes = useMemo(() => {
    const base = pollData?.codes ?? [];
    if (appendedCodes.length === 0) return base;
    const existingIds = new Set(base.map((c) => c.id));
    const uniqueAppended = appendedCodes.filter((c) => !existingIds.has(c.id));
    return [...base, ...uniqueAppended];
  }, [pollData?.codes, appendedCodes]);

  const activeNextCursor = cursorOverride ?? (pollData?.nextCursor ?? null);

  // Load More Handler
  async function handleLoadMore() {
    if (!activeNextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        event: eventSlug,
        cursor: String(activeNextCursor),
      });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (batchFilter !== "ALL") params.set("batch", batchFilter);
      if (debouncedQuery) params.set("q", debouncedQuery);

      const res = await fetch(`/api/admin/algohunt/codes?${params.toString()}`);
      const json = await res.json() as CodesResponse;
      if (json.ok) {
        setAppendedCodes((prev) => [...prev, ...json.codes]);
        setCursorOverride(json.nextCursor);
      }
    } catch (e) {
      console.error("Failed to load more codes", e);
    } finally {
      setLoadingMore(false);
    }
  }

  // Toggle reveal code
  function toggleReveal(id: string) {
    setRevealedCodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Handle Note Save on Blur
  async function handleSaveNote(codeId: string, currentSavedNote: string | null) {
    const newNote = editingNotes[codeId];
    if (newNote === undefined || newNote.trim() === (currentSavedNote ?? "")) return;
    try {
      await fetch(`/api/admin/algohunt/codes/${encodeURIComponent(codeId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "NOTE", placementNote: newNote.trim() }),
      });
      refreshCodes();
    } catch (e) {
      console.error("Failed to update note", e);
    }
  }

  // Generate Batch Handler
  async function handleConfirmGenerate(payload: { confirm: string }) {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch(
        `/api/admin/algohunt/codes/batches?event=${encodeURIComponent(eventSlug)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: batchName.trim(),
            size: Number(batchSize),
            confirm: payload.confirm,
          }),
        }
      );
      const json = await res.json() as {
        ok: boolean;
        batch?: { id: string; name: string };
        codes?: { serial: number; code: string }[];
        error?: string;
      };
      if (!res.ok || !json.ok || !json.batch || !json.codes) {
        setGenerateError(json.error ?? "Failed to create code batch.");
      } else {
        const serials = json.codes.map((c) => c.serial);
        const minS = Math.min(...serials);
        const maxS = Math.max(...serials);
        setCreatedBatchAlert({
          id: json.batch.id,
          name: json.batch.name,
          minSerial: minS,
          maxSerial: maxS,
        });
        setConfirmGenerateOpen(false);
        setBatchName(defaultBatchName());
        setBatchSize(20);
        refreshCodes();
      }
    } catch {
      setGenerateError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  // Disable Batch Handler
  async function handleConfirmDisableBatch(payload: { confirm: string; reason?: string }) {
    if (!batchToDisable) return;
    setDisablingBatch(true);
    try {
      const res = await fetch(
        `/api/admin/algohunt/codes/batches/${encodeURIComponent(batchToDisable.id)}/disable`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reason: payload.reason,
            confirm: payload.confirm,
          }),
        }
      );
      const json = await res.json() as { ok: boolean; disabled?: number; error?: string };
      if (res.ok && json.ok) {
        setBatchToDisable(null);
        refreshCodes();
      } else {
        alert(json.error ?? "Failed to disable batch.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setDisablingBatch(false);
    }
  }

  // Code Availability (Disable / Enable) Submit
  async function handleSaveAvailability(e: React.FormEvent) {
    e.preventDefault();
    if (!codeAvailabilityModal) return;
    const trimmed = availabilityReason.trim();
    if (trimmed.length < 5) {
      setAvailabilityError("Reason must be at least 5 characters.");
      return;
    }
    setSavingAvailability(true);
    setAvailabilityError(null);
    try {
      const res = await fetch(
        `/api/admin/algohunt/codes/${encodeURIComponent(codeAvailabilityModal.code.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: codeAvailabilityModal.action,
            reason: trimmed,
          }),
        }
      );
      const json = await res.json() as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setAvailabilityError(json.error ?? "Failed to update code.");
      } else {
        setCodeAvailabilityModal(null);
        setAvailabilityReason("");
        refreshCodes();
      }
    } catch {
      setAvailabilityError("Network error updating code.");
    } finally {
      setSavingAvailability(false);
    }
  }

  // Low pool warning condition: active <= 5 or active < teamsWaitingForCode
  const isPoolLow = stats && (stats.active <= 5 || stats.active < stats.teamsWaitingForCode);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-hairline pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("codes")}
          className={`mecha-btn text-xs ${
            activeTab === "codes" ? "mecha-btn--solid" : "mecha-btn--ghost"
          }`}
        >
          Codes & Batches
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("attempts")}
          className={`mecha-btn text-xs ${
            activeTab === "attempts" ? "mecha-btn--solid" : "mecha-btn--ghost"
          }`}
        >
          Redemption Attempts
        </button>
      </div>

      {activeTab === "codes" ? (
        <>
          {/* Low Pool Warning Banner */}
          {isPoolLow && (
            <div
              role="alert"
              className="rounded-2xl border-2 border-red-500/50 bg-red-500/15 p-4 flex items-start sm:items-center justify-between gap-4 text-red-800 dark:text-red-200"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 shrink-0 text-red-600 dark:text-red-400" />
                <div>
                  <h3 className="font-bold text-sm">Pool Running Low!</h3>
                  <p className="text-xs mt-0.5">
                    Only <span className="font-mono font-bold">{stats.active}</span> active codes remaining, but{" "}
                    <span className="font-mono font-bold">{stats.teamsWaitingForCode}</span> teams are waiting for a code. Generate a new batch and send volunteers to hide it.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const genCard = document.getElementById("generate-batch-section");
                  genCard?.scrollIntoView({ behavior: "smooth" });
                }}
                className="mecha-btn mecha-btn--sm bg-red-600 text-white hover:bg-red-700 shrink-0 border-red-700 text-xs"
              >
                Generate Now
              </button>
            </div>
          )}

          {/* Newly Created Batch Banner */}
          {createdBatchAlert && (
            <div
              role="status"
              className="rounded-2xl border border-emerald-500/40 bg-emerald-500/15 p-4 flex flex-wrap items-center justify-between gap-4 text-emerald-800 dark:text-emerald-200"
            >
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-medium">
                  Batch &lsquo;<span className="font-bold">{createdBatchAlert.name}</span>&rsquo; created:{" "}
                  <span className="font-mono font-bold">
                    #{String(createdBatchAlert.minSerial).padStart(3, "0")}–#{String(createdBatchAlert.maxSerial).padStart(3, "0")}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <AppLink
                  href={`/admin/algohunt/codes/print/${createdBatchAlert.id}`}
                  target="_blank"
                  className="mecha-btn mecha-btn--solid mecha-btn--sm inline-flex items-center gap-1.5 text-xs"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Now
                </AppLink>
                <button
                  type="button"
                  onClick={() => setCreatedBatchAlert(null)}
                  className="mecha-btn mecha-btn--ghost mecha-btn--sm text-xs"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <div className="lc-panel p-3">
              <span className="block font-mono text-[10px] uppercase text-charcoal/60">Active</span>
              <p className="mt-1 font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats?.active ?? "—"}
              </p>
            </div>
            <div className="lc-panel p-3">
              <span className="block font-mono text-[10px] uppercase text-charcoal/60">Used</span>
              <p className="mt-1 font-mono text-xl font-bold text-amber-600 dark:text-amber-400">
                {stats?.used ?? "—"}
              </p>
            </div>
            <div className="lc-panel p-3">
              <span className="block font-mono text-[10px] uppercase text-charcoal/60">Disabled</span>
              <p className="mt-1 font-mono text-xl font-bold text-charcoal/50">
                {stats?.disabled ?? "—"}
              </p>
            </div>
            <div className="lc-panel p-3">
              <span className="block font-mono text-[10px] uppercase text-charcoal/60">Total</span>
              <p className="mt-1 font-mono text-xl font-bold text-chocolate">
                {stats?.total ?? "—"}
              </p>
            </div>
            <div className="lc-panel p-3">
              <span className="block font-mono text-[10px] uppercase text-charcoal/60">Waiting</span>
              <p className="mt-1 font-mono text-xl font-bold text-purple-600 dark:text-purple-400">
                {stats?.teamsWaitingForCode ?? "—"}
              </p>
            </div>
            <div className="lc-panel p-3">
              <span className="block font-mono text-[10px] uppercase text-charcoal/60">Last 10 Min</span>
              <p className="mt-1 font-mono text-xl font-bold text-sky-600 dark:text-sky-400">
                {stats?.redeemedLast10m ?? "—"}
              </p>
            </div>
            <div className="lc-panel p-3 col-span-2 sm:col-span-1">
              <span className="block font-mono text-[10px] uppercase text-charcoal/60">Last Redeemed</span>
              <p className="mt-1 font-mono text-xs font-semibold text-charcoal/80 truncate">
                {stats?.lastRedeemedAt ? formatIST(stats.lastRedeemedAt) : "None yet"}
              </p>
            </div>
          </div>

          {/* Generate Batch Form */}
          <div id="generate-batch-section" className="lc-panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-chocolate flex items-center gap-2">
                <Plus className="w-5 h-5 text-bronze" /> Generate Code Batch
              </h2>
              <span className="text-xs font-mono text-charcoal/60">1–200 codes per batch</span>
            </div>

            {generateError && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
                {generateError}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2 space-y-1">
                <label htmlFor="batch-name" className="block text-xs font-mono uppercase text-charcoal/70">
                  Batch Name
                </label>
                <input
                  id="batch-name"
                  type="text"
                  className="mecha-input text-sm"
                  placeholder="e.g. Live batch 11:30"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  maxLength={60}
                  disabled={generating}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="batch-size" className="block text-xs font-mono uppercase text-charcoal/70">
                  Size (1–200)
                </label>
                <input
                  id="batch-size"
                  type="number"
                  min={1}
                  max={200}
                  className="mecha-input text-sm font-mono"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Math.max(1, Math.min(200, parseInt(e.target.value, 10) || 1)))}
                  disabled={generating}
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={generating || !batchName.trim() || batchSize < 1 || batchSize > 200}
                onClick={() => setConfirmGenerateOpen(true)}
                className="mecha-btn mecha-btn--solid text-xs inline-flex items-center gap-2"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Generate Batch
              </button>
            </div>
          </div>

          {/* Batches Table */}
          <div className="lc-panel overflow-hidden space-y-3 p-5">
            <h2 className="font-display text-lg font-bold text-chocolate">Batches</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-hairline font-mono uppercase text-[11px] text-charcoal/50">
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Size</th>
                    <th className="pb-2">Created (IST)</th>
                    <th className="pb-2 text-emerald-600 dark:text-emerald-400">Active</th>
                    <th className="pb-2 text-amber-600 dark:text-amber-400">Used</th>
                    <th className="pb-2 text-charcoal/50">Disabled</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center font-mono text-charcoal/60">
                        No batches created yet.
                      </td>
                    </tr>
                  ) : (
                    batches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-hairline/20">
                        <td className="py-2.5 font-medium text-chocolate">{batch.name}</td>
                        <td className="py-2.5 font-mono">{batch.size}</td>
                        <td className="py-2.5 font-mono text-charcoal/70">{formatIST(batch.createdAt)}</td>
                        <td className="py-2.5 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          {batch.active}
                        </td>
                        <td className="py-2.5 font-mono text-amber-600 dark:text-amber-400 font-bold">
                          {batch.used}
                        </td>
                        <td className="py-2.5 font-mono text-charcoal/50 font-bold">{batch.disabled}</td>
                        <td className="py-2.5 text-right space-x-2">
                          <AppLink
                            href={`/admin/algohunt/codes/print/${batch.id}`}
                            target="_blank"
                            className="mecha-btn mecha-btn--ghost text-[11px] px-2.5 py-1 inline-flex items-center gap-1"
                          >
                            <Printer className="w-3 h-3" /> Print
                          </AppLink>
                          {batch.active > 0 && (
                            <button
                              type="button"
                              onClick={() => setBatchToDisable(batch)}
                              className="mecha-btn mecha-btn--ghost text-[11px] px-2.5 py-1 text-red-600 hover:text-red-700"
                            >
                              Disable remaining
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Codes Table Section */}
          <div className="lc-panel p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-chocolate">Codes Pool</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refreshCodes()}
                  className="mecha-btn mecha-btn--ghost text-xs p-1.5"
                  title="Refresh codes"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="grid gap-3 sm:grid-cols-3">
              {/* Status Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {["ALL", "ACTIVE", "USED", "DISABLED"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(st)}
                    className={`mecha-chip text-[11px] font-mono transition ${
                      statusFilter === st
                        ? "bg-bronze text-white font-bold"
                        : "bg-panel text-charcoal/70 hover:bg-hairline/40"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Batch Filter Select */}
              <div>
                <select
                  className="mecha-input text-xs w-full"
                  value={batchFilter}
                  onChange={(e) => handleBatchChange(e.target.value)}
                >
                  <option value="ALL">All Batches</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.size})
                    </option>
                  ))}
                </select>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 text-charcoal/50 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search serial, code, or team..."
                  className="mecha-input text-xs pl-8 w-full"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
            </div>

            {/* Codes Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-hairline font-mono uppercase text-[11px] text-charcoal/50">
                    <th className="pb-2">#Serial</th>
                    <th className="pb-2">Code</th>
                    <th className="pb-2">Batch</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Used By</th>
                    <th className="pb-2">Unlocked From</th>
                    <th className="pb-2">Used At</th>
                    <th className="pb-2">Placement Note</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {allCodes.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center font-mono text-charcoal/60">
                        {pollError ? "Failed to load codes." : "No codes found matching criteria."}
                      </td>
                    </tr>
                  ) : (
                    allCodes.map((code) => {
                      const isRevealed = revealedCodeIds.has(code.id);
                      return (
                        <tr key={code.id} className="hover:bg-hairline/20">
                          <td className="py-2.5 font-mono font-bold text-chocolate">
                            #{String(code.serial).padStart(3, "0")}
                          </td>
                          <td className="py-2.5 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span>
                                {isRevealed ? formatCodeForDisplay(code.code) : "••••-••••"}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleReveal(code.id)}
                                className="p-1 text-charcoal/50 hover:text-chocolate transition"
                                title={isRevealed ? "Mask code" : "Reveal code"}
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 text-charcoal/70 truncate max-w-[120px]">
                            {code.batchName}
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`mecha-chip text-[10px] font-mono px-2 py-0.5 rounded-full ${
                                code.status === "ACTIVE"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold"
                                  : code.status === "USED"
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                  : "bg-red-500/15 text-red-700 dark:text-red-300 line-through"
                              }`}
                            >
                              {code.status}
                            </span>
                          </td>
                          <td className="py-2.5 font-mono">
                            {code.usedByTeam ? (
                              <span title={code.usedByTeam.name} className="truncate max-w-[130px] block">
                                {code.usedByTeam.name} ({code.usedByTeam.code})
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2.5 font-mono">
                            {code.usedForStageNumber !== null ? `Q ${code.usedForStageNumber}` : "—"}
                          </td>
                          <td className="py-2.5 font-mono text-charcoal/60">
                            {code.usedAt ? formatIST(code.usedAt) : "—"}
                          </td>
                          <td className="py-2.5">
                            <input
                              type="text"
                              className="mecha-input text-xs py-1 px-2 w-36 max-w-full"
                              placeholder="Add note..."
                              maxLength={200}
                              value={
                                editingNotes[code.id] !== undefined
                                  ? editingNotes[code.id]
                                  : code.placementNote ?? ""
                              }
                              onChange={(e) =>
                                setEditingNotes((prev) => ({ ...prev, [code.id]: e.target.value }))
                              }
                              onBlur={() => handleSaveNote(code.id, code.placementNote)}
                            />
                          </td>
                          <td className="py-2.5 text-right">
                            {code.status === "ACTIVE" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCodeAvailabilityModal({ code, action: "DISABLE" });
                                  setAvailabilityReason("");
                                  setAvailabilityError(null);
                                }}
                                className="mecha-btn mecha-btn--ghost text-[11px] text-red-600 hover:text-red-700 px-2 py-1"
                              >
                                Disable
                              </button>
                            )}
                            {code.status === "DISABLED" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCodeAvailabilityModal({ code, action: "ENABLE" });
                                  setAvailabilityReason("");
                                  setAvailabilityError(null);
                                }}
                                className="mecha-btn mecha-btn--ghost text-[11px] text-emerald-600 hover:text-emerald-700 px-2 py-1"
                              >
                                Enable
                              </button>
                            )}
                            {code.status === "USED" && (
                              <span className="text-charcoal/40 font-mono text-[11px]">Locked</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Load More Button */}
            {activeNextCursor && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={handleLoadMore}
                  className="mecha-btn mecha-btn--ghost text-xs inline-flex items-center gap-2"
                >
                  {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Load More Codes
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Attempts Tab */
        <div className="lc-panel p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-chocolate flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-bronze" /> Redemption Attempts
              </h2>
              <p className="text-xs text-charcoal/60">
                Latest 200 code submission attempts across the event.
              </p>
            </div>
            <button
              type="button"
              onClick={() => refreshAttempts()}
              disabled={loadingAttempts}
              className="mecha-btn mecha-btn--ghost text-xs inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAttempts ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>

          {/* Attempts Filters */}
          <div className="grid gap-3 sm:grid-cols-4 items-center">
            <div>
              <label className="block text-[11px] font-mono uppercase text-charcoal/70 mb-1">
                Filter by Team Code
              </label>
              <input
                type="text"
                placeholder="Team code..."
                className="mecha-input text-xs w-full"
                value={attemptTeam}
                onChange={(e) => setAttemptTeam(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-charcoal/70 mb-1">
                Result Type
              </label>
              <select
                className="mecha-input text-xs w-full"
                value={attemptResult}
                onChange={(e) => setAttemptResult(e.target.value)}
              >
                <option value="ALL">All Results</option>
                <option value="UNLOCKED">UNLOCKED</option>
                <option value="ALREADY_UNLOCKED">ALREADY_UNLOCKED</option>
                <option value="ALREADY_USED">ALREADY_USED</option>
                <option value="INVALID">INVALID</option>
                <option value="NOT_SOLVED">NOT_SOLVED</option>
                <option value="COOLDOWN">COOLDOWN</option>
              </select>
            </div>

            <div className="sm:col-span-2 flex items-center gap-2 pt-4 sm:pt-0">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={suspiciousOnly}
                  onChange={(e) => setSuspiciousOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-hairline text-red-600 focus:ring-red-600"
                />
                <span className="text-red-700 dark:text-red-300 font-semibold">
                  Suspicious attempts only (≥ 5 INVALID in last 10 min)
                </span>
              </label>
            </div>
          </div>

          {/* Attempts Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-hairline font-mono uppercase text-[11px] text-charcoal/50">
                  <th className="pb-2">Time (IST)</th>
                  <th className="pb-2">Team</th>
                  <th className="pb-2">Stage</th>
                  <th className="pb-2">Submitted Code</th>
                  <th className="pb-2">Result</th>
                  <th className="pb-2">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {attempts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center font-mono text-charcoal/60">
                      {loadingAttempts ? "Loading attempts..." : "No redemption attempts found."}
                    </td>
                  </tr>
                ) : (
                  attempts.map((attempt) => (
                    <tr key={attempt.id} className="hover:bg-hairline/20">
                      <td className="py-2.5 font-mono text-charcoal/70">
                        {formatIST(attempt.createdAt)}
                      </td>
                      <td className="py-2.5 font-medium text-chocolate">
                        {attempt.teamName}{" "}
                        <span className="font-mono text-charcoal/60">({attempt.teamCode})</span>
                      </td>
                      <td className="py-2.5 font-mono">
                        {attempt.stageNumber !== null ? `Q ${attempt.stageNumber}` : "—"}
                      </td>
                      <td className="py-2.5 font-mono font-bold tracking-wider">
                        {attempt.submittedCode ? formatCodeForDisplay(attempt.submittedCode) : "—"}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-mono ${
                            RESULT_CHIPS[attempt.result] ?? "bg-panel text-charcoal"
                          }`}
                        >
                          {attempt.result}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono text-charcoal/50">{attempt.ip ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Creating Batch */}
      <ConfirmAction
        open={confirmGenerateOpen}
        title="Create Code Batch"
        consequences={`This will generate ${batchSize} fresh 8-character codes for "${batchName}".`}
        confirmPhrase={eventSlug}
        confirmLabel="Generate Now"
        onConfirm={handleConfirmGenerate}
        onClose={() => setConfirmGenerateOpen(false)}
      />

      {/* Confirmation Modal for Disabling Remaining in Batch */}
      {batchToDisable && (
        <ConfirmAction
          open={true}
          title={`Disable Remaining in "${batchToDisable.name}"`}
          consequences={`This will disable all ${batchToDisable.active} ACTIVE codes in this batch. Used codes will remain untouched.`}
          confirmPhrase={eventSlug}
          requireReason={true}
          confirmLabel="Disable Codes"
          danger={true}
          onConfirm={handleConfirmDisableBatch}
          onClose={() => setBatchToDisable(null)}
        />
      )}

      {/* Single Code Availability (Enable/Disable) Modal */}
      {codeAvailabilityModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-hairline bg-panel p-6 shadow-2xl my-auto space-y-4">
            <h3 className="font-display text-lg font-bold text-chocolate">
              {codeAvailabilityModal.action === "DISABLE" ? "Disable" : "Enable"} Code #
              {String(codeAvailabilityModal.code.serial).padStart(3, "0")}
            </h3>
            <p className="text-xs text-charcoal/70">
              Provide an audit reason for {codeAvailabilityModal.action.toLowerCase()}ing this code.
            </p>

            {availabilityError && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
                {availabilityError}
              </div>
            )}

            <form onSubmit={handleSaveAvailability} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-mono uppercase text-charcoal/70">
                  Reason (5–500 chars)
                </label>
                <textarea
                  className="mecha-input text-xs min-h-20"
                  placeholder="Reason..."
                  value={availabilityReason}
                  onChange={(e) => setAvailabilityReason(e.target.value)}
                  maxLength={500}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCodeAvailabilityModal(null)}
                  disabled={savingAvailability}
                  className="mecha-btn mecha-btn--ghost text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAvailability || availabilityReason.trim().length < 5}
                  className={`mecha-btn text-xs ${
                    codeAvailabilityModal.action === "DISABLE"
                      ? "bg-red-600 hover:bg-red-700 text-white border-red-700"
                      : "mecha-btn--solid"
                  }`}
                >
                  {savingAvailability
                    ? "Saving..."
                    : codeAvailabilityModal.action === "DISABLE"
                    ? "Disable Code"
                    : "Enable Code"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
