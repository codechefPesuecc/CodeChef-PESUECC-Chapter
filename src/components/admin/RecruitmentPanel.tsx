"use client";

import { useState, useMemo } from "react";
import MechaPanel from "@/components/cp-arena/MechaPanel";
import {
  RECRUITMENT_DOMAINS,
  DOMAIN_QUESTIONS,
  WRAP_UP_QUESTIONS,
  DOMAIN_SHORT_NAMES,
  type RecruitmentDomain,
} from "@/lib/recruitment-schema";
import type { AdminApplicationItem } from "@/server/recruitment-applications";

export interface RecruitmentSettingsState {
  isOpen: boolean;
  formUrl: string | null;
  cycle: string | null;
  closesOn: string | null;
  updatedAt: number | null;
  updatedBy: string | null;
}

interface RecruitmentPanelProps {
  initialSettings: RecruitmentSettingsState;
  initialApplications: AdminApplicationItem[];
}

const inputCls = "mecha-input";

export default function RecruitmentPanel({
  initialSettings,
  initialApplications,
}: RecruitmentPanelProps) {
  const [activeTab, setActiveTab] = useState<"applications" | "settings">("applications");

  // Settings State
  const [isOpen, setIsOpen] = useState(initialSettings.isOpen);
  const [formUrl, setFormUrl] = useState(initialSettings.formUrl ?? "");
  const [cycle, setCycle] = useState(initialSettings.cycle ?? "");
  const [closesOn, setClosesOn] = useState(initialSettings.closesOn ?? "");
  const [savedSettings, setSavedSettings] = useState(initialSettings);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Applications State
  const [applications, setApplications] = useState<AdminApplicationItem[]>(initialApplications);
  const [selectedApp, setSelectedApp] = useState<AdminApplicationItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Review Modal State
  const [reviewStatus, setReviewStatus] = useState<string>("");
  const [reviewerNotes, setReviewerNotes] = useState<string>("");
  const [savingReview, setSavingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Open review modal
  const openReview = (app: AdminApplicationItem) => {
    setSelectedApp(app);
    setReviewStatus(app.status);
    setReviewerNotes(app.reviewerNotes ?? "");
    setReviewError(null);
  };

  const closeReview = () => {
    setSelectedApp(null);
    setReviewError(null);
  };

  const handleSaveReview = async () => {
    if (!selectedApp) return;
    setSavingReview(true);
    setReviewError(null);

    try {
      const res = await fetch("/api/admin/recruitment/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: selectedApp.id,
          status: reviewStatus,
          reviewerNotes,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        setReviewError(data.error ?? "Failed to update status.");
        setSavingReview(false);
        return;
      }

      // Update local state
      setApplications((prev) =>
        prev.map((item) =>
          item.id === selectedApp.id
            ? {
                ...item,
                status: reviewStatus as AdminApplicationItem["status"],
                reviewerNotes,
                reviewedAt: Date.now(),
              }
            : item,
        ),
      );

      setSelectedApp((prev) =>
        prev
          ? {
              ...prev,
              status: reviewStatus as AdminApplicationItem["status"],
              reviewerNotes,
              reviewedAt: Date.now(),
            }
          : null,
      );

      setSavingReview(false);
    } catch {
      setReviewError("Network error while saving review.");
      setSavingReview(false);
    }
  };

  // Quick inline status change
  const handleQuickStatusChange = async (appId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/admin/recruitment/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: appId,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setApplications((prev) =>
          prev.map((item) =>
            item.id === appId
              ? {
                  ...item,
                  status: newStatus as AdminApplicationItem["status"],
                  reviewedAt: Date.now(),
                }
              : item,
          ),
        );
      }
    } catch {
      // Ignored
    }
  };

  // Settings Save
  const isSettingsDirty =
    isOpen !== savedSettings.isOpen ||
    formUrl !== (savedSettings.formUrl ?? "") ||
    cycle !== (savedSettings.cycle ?? "") ||
    closesOn !== (savedSettings.closesOn ?? "");

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsError(null);

    try {
      const patch: Record<string, unknown> = {};
      if (isOpen !== savedSettings.isOpen) patch.isOpen = isOpen;
      if (formUrl !== (savedSettings.formUrl ?? "")) patch.formUrl = formUrl;
      if (cycle !== (savedSettings.cycle ?? "")) patch.cycle = cycle;
      if (closesOn !== (savedSettings.closesOn ?? "")) patch.closesOn = closesOn;

      const res = await fetch("/api/admin/recruitment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!data.ok) {
        setSettingsError(data.error ?? "Failed to save settings.");
        setSavingSettings(false);
        return;
      }

      const s = data.settings as RecruitmentSettingsState;
      setSavedSettings(s);
      setIsOpen(s.isOpen);
      setFormUrl(s.formUrl ?? "");
      setCycle(s.cycle ?? "");
      setClosesOn(s.closesOn ?? "");
      setSavingSettings(false);
    } catch {
      setSettingsError("Network error while saving settings.");
      setSavingSettings(false);
    }
  };

  // Filtered Applications
  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      // Domain filter
      if (domainFilter !== "all" && !app.domains.includes(domainFilter as RecruitmentDomain)) {
        return false;
      }
      // Status filter
      if (statusFilter !== "all" && app.status !== statusFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (app.user.name || "").toLowerCase().includes(q);
        const matchesUser = app.user.username.toLowerCase().includes(q);
        const matchesEmail = app.user.email.toLowerCase().includes(q);
        const matchesPrn = app.user.prn.toLowerCase().includes(q);
        const matchesSrn = (app.user.srn || "").toLowerCase().includes(q);
        const matchesPhone = app.phone.toLowerCase().includes(q);
        const matchesBranch = app.branch.toLowerCase().includes(q);
        return (
          matchesName ||
          matchesUser ||
          matchesEmail ||
          matchesPrn ||
          matchesSrn ||
          matchesPhone ||
          matchesBranch
        );
      }
      return true;
    });
  }, [applications, domainFilter, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = applications.length;
    const domainCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};

    for (const d of RECRUITMENT_DOMAINS) domainCounts[d] = 0;

    for (const app of applications) {
      statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
      for (const d of app.domains) {
        domainCounts[d] = (domainCounts[d] || 0) + 1;
      }
    }

    return { total, domainCounts, statusCounts };
  }, [applications]);

  const cleanPhoneForWa = (p: string) => {
    const digits = p.replace(/\D/g, "");
    if (digits.length === 10) return `91${digits}`;
    return digits;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "shortlisted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Shortlisted
          </span>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-purple-600 dark:text-purple-400">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
            Offer
          </span>
        );
      case "under_review":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Reviewing
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-bronze/30 bg-bronze/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-bronze">
            <span className="h-1.5 w-1.5 rounded-full bg-bronze" />
            Submitted
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation Tabs */}
      <div className="flex border-b border-hairline gap-4">
        <button
          type="button"
          onClick={() => setActiveTab("applications")}
          className={`pb-3 font-display text-sm font-semibold transition-all border-b-2 ${
            activeTab === "applications"
              ? "border-bronze text-chocolate"
              : "border-transparent text-charcoal/60 hover:text-chocolate"
          }`}
        >
          Applications ({applications.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`pb-3 font-display text-sm font-semibold transition-all border-b-2 ${
            activeTab === "settings"
              ? "border-bronze text-chocolate"
              : "border-transparent text-charcoal/60 hover:text-chocolate"
          }`}
        >
          Drive Settings & Status
        </button>
      </div>

      {/* Applications Tab */}
      {activeTab === "applications" && (
        <div className="space-y-6">
          {/* Summary Stats Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-hairline bg-panel p-4">
              <span className="font-mono text-xs text-charcoal/60 uppercase">Total Applicants</span>
              <p className="mt-1 font-display text-2xl font-bold text-chocolate">{stats.total}</p>
              <span className="font-mono text-[11px] text-bronze">Cycle: {savedSettings.cycle || "Current"}</span>
            </div>

            <div className="rounded-xl border border-hairline bg-panel p-4">
              <span className="font-mono text-xs text-charcoal/60 uppercase">Shortlisted</span>
              <p className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.statusCounts.shortlisted || 0}
              </p>
              <span className="font-mono text-[11px] text-charcoal/60">
                {stats.statusCounts.accepted || 0} offers given
              </span>
            </div>

            <div className="rounded-xl border border-hairline bg-panel p-4">
              <span className="font-mono text-xs text-charcoal/60 uppercase">In Review / Pending</span>
              <p className="mt-1 font-display text-2xl font-bold text-amber-600 dark:text-amber-400">
                {(stats.statusCounts.submitted || 0) + (stats.statusCounts.under_review || 0)}
              </p>
              <span className="font-mono text-[11px] text-charcoal/60">
                {stats.statusCounts.rejected || 0} not shortlisted
              </span>
            </div>

            <div className="rounded-xl border border-hairline bg-panel p-4 flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs text-charcoal/60 uppercase">Quick Actions</span>
                <p className="text-xs text-charcoal/75 mt-1">Export full spreadsheet</p>
              </div>
              <a
                href={`/api/admin/recruitment/export${savedSettings.cycle ? `?cycle=${encodeURIComponent(savedSettings.cycle)}` : ""}`}
                className="mecha-btn mecha-btn--solid text-xs inline-flex items-center justify-center gap-1.5 mt-2"
                download
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export CSV
              </a>
            </div>
          </div>

          {/* Domain Breakdown Pills */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="font-mono text-xs text-charcoal/60 uppercase">Domains:</span>
            {RECRUITMENT_DOMAINS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDomainFilter(domainFilter === d ? "all" : d)}
                className={`px-2.5 py-1 rounded-full font-mono text-xs border transition-all ${
                  domainFilter === d
                    ? "bg-bronze text-cream border-bronze font-semibold"
                    : "bg-panel border-hairline text-charcoal hover:border-bronze"
                }`}
              >
                {DOMAIN_SHORT_NAMES[d]}: {stats.domainCounts[d] || 0}
              </button>
            ))}
          </div>

          {/* Filters and Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidate name, username, PRN, email, phone..."
                className={inputCls}
              />
            </div>

            <div className="flex gap-2">
              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className={`${inputCls} text-xs w-36`}
              >
                <option value="all">All Domains</option>
                {RECRUITMENT_DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`${inputCls} text-xs w-36`}
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Applications Table */}
          <div className="overflow-x-auto rounded-xl border border-hairline bg-panel shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-hairline bg-canvas/40 font-mono text-charcoal/70 uppercase">
                  <th className="p-3 pl-4">Candidate</th>
                  <th className="p-3">Academic</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Domains</th>
                  <th className="p-3">Arena Solves</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {filteredApps.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-charcoal/60 font-mono">
                      No applications match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredApps.map((app) => (
                    <tr key={app.id} className="hover:bg-canvas/30 transition-colors">
                      <td className="p-3 pl-4">
                        <p className="font-semibold text-chocolate">
                          {app.user.name || app.user.username}
                        </p>
                        <p className="font-mono text-[11px] text-bronze">@{app.user.username}</p>
                      </td>

                      <td className="p-3">
                        <p className="font-mono font-medium text-chocolate">
                          {app.yearOfStudy} Yr · {app.branch}
                        </p>
                        <p className="font-mono text-[11px] text-charcoal/60">
                          {app.user.prn} {app.user.srn ? `· ${app.user.srn}` : ""}
                        </p>
                      </td>

                      <td className="p-3 font-mono">
                        <p className="text-chocolate">{app.user.email}</p>
                        <a
                          href={`https://wa.me/${cleanPhoneForWa(app.phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                        >
                          💬 {app.phone}
                        </a>
                      </td>

                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {app.domains.map((d) => (
                            <span
                              key={d}
                              className="inline-flex items-center rounded-md border border-hairline bg-canvas px-1.5 py-0.5 font-mono text-[10px] font-bold text-chocolate"
                            >
                              {DOMAIN_SHORT_NAMES[d]}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="p-3 font-mono">
                        <span className="font-semibold text-chocolate">{app.arenaStats.solved}</span> solved
                        <span className="text-charcoal/60 text-[11px] ml-1">({app.arenaStats.points} pts)</span>
                      </td>

                      <td className="p-3">
                        <select
                          value={app.status}
                          onChange={(e) => handleQuickStatusChange(app.id, e.target.value)}
                          className="bg-panel border border-hairline rounded px-2 py-1 text-xs font-mono text-chocolate cursor-pointer"
                        >
                          <option value="submitted">Submitted</option>
                          <option value="under_review">In Review</option>
                          <option value="shortlisted">Shortlisted</option>
                          <option value="accepted">Accepted</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>

                      <td className="p-3 pr-4 text-right">
                        <button
                          type="button"
                          onClick={() => openReview(app)}
                          className="mecha-btn mecha-btn--ghost text-xs px-2.5 py-1"
                        >
                          Review &rarr;
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <form
          onSubmit={handleSaveSettings}
          className="rounded-2xl border border-hairline bg-panel p-6 shadow-sm space-y-6"
        >
          {settingsError && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {settingsError}
            </div>
          )}

          <div>
            <h3 className="font-display text-lg font-bold text-chocolate">Drive Configuration</h3>
            <p className="text-xs text-charcoal/70 mt-0.5">
              Control when recruitments are open on the platform.
            </p>
          </div>

          <label className="flex items-center gap-3 text-sm font-medium text-chocolate cursor-pointer">
            <input
              type="checkbox"
              checked={isOpen}
              onChange={(e) => setIsOpen(e.target.checked)}
              className="h-4 w-4 rounded border-hairline text-bronze focus:ring-bronze"
            />
            <span>Open for applications (Show native application form on /join)</span>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-xs font-mono text-charcoal/70 uppercase">
              Recruitment Cycle Label
              <input
                value={cycle}
                onChange={(e) => setCycle(e.target.value)}
                placeholder="2026-27"
                className={`${inputCls} mt-1`}
              />
            </label>

            <label className="text-xs font-mono text-charcoal/70 uppercase">
              Application Deadline (Closes On)
              <input
                type="date"
                value={closesOn}
                onChange={(e) => setClosesOn(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>

            <label className="text-xs font-mono text-charcoal/70 uppercase sm:col-span-2">
              Legacy / Fallback Google Form URL (Optional)
              <input
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://docs.google.com/forms/d/e/.../viewform"
                className={`${inputCls} mt-1`}
              />
              <span className="text-[11px] text-charcoal/60 lowercase font-sans">
                Only needed if directing users externally. Native application form is used by default.
              </span>
            </label>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={savingSettings || !isSettingsDirty}
              className="mecha-btn mecha-btn--solid text-xs"
            >
              {savingSettings ? "Saving..." : "Save Drive Settings"}
            </button>
            {!isSettingsDirty && !settingsError && (
              <span className="text-xs font-mono text-charcoal/50">
                {savedSettings.updatedAt ? "Saved to database." : "Ready."}
              </span>
            )}
          </div>
        </form>
      )}

      {/* Candidate Review Modal */}
      {selectedApp && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-hairline bg-panel shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-hairline p-5 bg-canvas/40">
              <div className="flex items-center gap-3">
                <h3 className="font-display text-lg font-bold text-chocolate">
                  Review Candidate: {selectedApp.user.name || selectedApp.user.username}
                </h3>
                {getStatusBadge(selectedApp.status)}
              </div>
              <button
                type="button"
                onClick={closeReview}
                className="p-1 rounded-lg text-charcoal/60 hover:text-chocolate hover:bg-hairline/40 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Candidate Info Card */}
              <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-hairline bg-canvas/30 p-4">
                <div>
                  <span className="font-mono text-bronze uppercase">Profile</span>
                  <p className="font-medium text-sm text-chocolate mt-0.5">
                    {selectedApp.user.name || "—"} (@{selectedApp.user.username})
                  </p>
                  <p className="text-charcoal/70">{selectedApp.user.email}</p>
                  <a
                    href={`https://wa.me/${cleanPhoneForWa(selectedApp.phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 dark:text-emerald-400 font-mono font-medium hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    💬 WhatsApp: {selectedApp.phone} &rarr;
                  </a>
                </div>

                <div>
                  <span className="font-mono text-bronze uppercase">Academic & Arena</span>
                  <p className="text-chocolate font-mono font-medium mt-0.5">
                    {selectedApp.yearOfStudy} Year · {selectedApp.branch}
                  </p>
                  <p className="text-charcoal/70 font-mono">
                    PRN: {selectedApp.user.prn} {selectedApp.user.srn ? `· SRN: ${selectedApp.user.srn}` : ""}
                  </p>
                  <p className="text-bronze font-mono font-semibold mt-1">
                    Arena Solves: {selectedApp.arenaStats.solved} ({selectedApp.arenaStats.points} pts)
                  </p>
                </div>
              </div>

              {/* Chosen Domains */}
              <div>
                <span className="font-mono text-bronze uppercase">Applied Domains</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {selectedApp.domains.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 rounded-full border border-bronze/40 bg-bronze/10 px-3 py-1 font-mono text-xs font-semibold text-chocolate"
                    >
                      <span className="text-bronze">[{DOMAIN_SHORT_NAMES[d]}]</span> {d}
                    </span>
                  ))}
                </div>
              </div>

              {/* Domain Specific Answers */}
              {selectedApp.domains.map((domain) => (
                <div key={domain} className="rounded-xl border border-hairline bg-canvas/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 border-b border-hairline/60 pb-2">
                    <span className="font-mono font-bold text-bronze">[{DOMAIN_SHORT_NAMES[domain]}]</span>
                    <h4 className="font-display font-bold text-sm text-chocolate">{domain} Questions</h4>
                  </div>
                  <div className="space-y-3">
                    {DOMAIN_QUESTIONS[domain].map((q) => {
                      const ans = selectedApp.responses[q.id];
                      return (
                        <div key={q.id} className="space-y-1">
                          <p className="font-medium text-charcoal/70">{q.label}</p>
                          <div className="rounded-lg border border-hairline/60 bg-panel p-2.5 font-mono text-chocolate whitespace-pre-wrap">
                            {Array.isArray(ans) ? ans.join(", ") : ans || "—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Wrapping Up Responses */}
              <div className="rounded-xl border border-hairline bg-canvas/40 p-4 space-y-3">
                <h4 className="font-display font-bold text-sm text-chocolate border-b border-hairline/60 pb-2">
                  Wrapping Up Responses
                </h4>
                <div className="space-y-3">
                  {WRAP_UP_QUESTIONS.map((q) => {
                    const ans = selectedApp.responses[q.id];
                    return (
                      <div key={q.id} className="space-y-1">
                        <p className="font-medium text-charcoal/70">{q.label}</p>
                        <div className="rounded-lg border border-hairline/60 bg-panel p-2.5 font-mono text-chocolate whitespace-pre-wrap">
                          {ans || "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Review & Decision Section */}
              <div className="rounded-xl border border-bronze/30 bg-bronze/5 p-4 space-y-4">
                <h4 className="font-display font-bold text-sm text-chocolate">
                  Reviewer Decision & Notes
                </h4>

                {reviewError && (
                  <p className="text-rose-500 font-mono text-xs">{reviewError}</p>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block font-mono text-charcoal/70 uppercase">
                      Application Status
                    </label>
                    <select
                      value={reviewStatus}
                      onChange={(e) => setReviewStatus(e.target.value)}
                      className={`${inputCls} mt-1 font-mono`}
                    >
                      <option value="submitted">Submitted</option>
                      <option value="under_review">Under Review</option>
                      <option value="shortlisted">Shortlisted</option>
                      <option value="accepted">Accepted (Offer)</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-charcoal/70 uppercase">
                      Internal Reviewer Notes
                    </label>
                    <textarea
                      value={reviewerNotes}
                      onChange={(e) => setReviewerNotes(e.target.value)}
                      placeholder="Notes on candidate interview, strengths, weaknesses..."
                      className={`${inputCls} mt-1 resize-y`}
                      rows={2}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeReview}
                    className="mecha-btn mecha-btn--ghost text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveReview}
                    disabled={savingReview}
                    className="mecha-btn mecha-btn--solid text-xs"
                  >
                    {savingReview ? "Saving..." : "Save Review Decision"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
