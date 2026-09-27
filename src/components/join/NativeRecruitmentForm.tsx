"use client";

import { useState } from "react";
import MechaPanel from "@/components/cp-arena/MechaPanel";
import {
  RECRUITMENT_DOMAINS,
  DOMAIN_QUESTIONS,
  WRAP_UP_QUESTIONS,
  HEARD_FROM_OPTIONS,
  YEAR_OF_STUDY_OPTIONS,
  BRANCH_OPTIONS,
  DOMAIN_SHORT_NAMES,
  countWords,
  type RecruitmentDomain,
  type RecruitmentQuestion,
} from "@/lib/recruitment-schema";
import type { ApplicationResponseData } from "@/server/recruitment-applications";
import type { SessionUser } from "@/server/auth/session";

interface NativeRecruitmentFormProps {
  user: SessionUser;
  existingApp: ApplicationResponseData | null;
  cycle: string;
  isOpen: boolean;
}

const inputCls = "mecha-input";

export default function NativeRecruitmentForm({
  user,
  existingApp,
  cycle,
  isOpen,
}: NativeRecruitmentFormProps) {
  const [editing, setEditing] = useState(!existingApp);
  const [domains, setDomains] = useState<RecruitmentDomain[]>(
    existingApp?.domains ?? [],
  );
  const [yearOfStudy, setYearOfStudy] = useState(
    existingApp?.yearOfStudy ?? "1st",
  );
  const [branch, setBranch] = useState(existingApp?.branch ?? "");
  const [phone, setPhone] = useState(existingApp?.phone ?? user.phone ?? "");
  const [prn, setPrn] = useState(user.prn ?? "");
  const [srn, setSrn] = useState(user.srn ?? "");
  const [heardFrom, setHeardFrom] = useState(existingApp?.heardFrom ?? "");
  const [responses, setResponses] = useState<Record<string, unknown>>(
    existingApp?.responses ?? {},
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeDomainTab, setActiveDomainTab] = useState<RecruitmentDomain | null>(
    existingApp?.domains?.[0] ?? null,
  );

  const handleDomainToggle = (d: RecruitmentDomain) => {
    if (domains.includes(d)) {
      const next = domains.filter((item) => item !== d);
      setDomains(next);
      if (activeDomainTab === d) {
        setActiveDomainTab(next[0] ?? null);
      }
    } else {
      if (domains.length >= 2) {
        setError("You can select up to 2 domains.");
        return;
      }
      setError(null);
      const next = [...domains, d];
      setDomains(next);
      if (!activeDomainTab) setActiveDomainTab(d);
    }
  };

  const handleResponseChange = (qid: string, value: unknown) => {
    setResponses((prev) => ({ ...prev, [qid]: value }));
  };

  const handleCheckboxOptionToggle = (qid: string, option: string) => {
    const current: string[] = Array.isArray(responses[qid]) ? responses[qid] : [];
    if (current.includes(option)) {
      setResponses((prev) => ({
        ...prev,
        [qid]: current.filter((item) => item !== option),
      }));
    } else {
      setResponses((prev) => ({
        ...prev,
        [qid]: [...current, option],
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (domains.length === 0) {
      setError("Please select at least one domain to apply for.");
      return;
    }

    if (!prn.trim()) {
      setError("Please enter your PRN (Permanent Registration Number).");
      return;
    }

    if (!branch.trim()) {
      setError("Please enter your branch/major.");
      return;
    }

    if (!phone.trim()) {
      setError("Please enter your WhatsApp / Phone number.");
      return;
    }

    // Client-side word count verification
    for (const domain of domains) {
      for (const q of DOMAIN_QUESTIONS[domain]) {
        const val = responses[q.id];
        if (q.required && (val === undefined || val === null || String(val).trim() === "")) {
          setActiveDomainTab(domain);
          setError(`Please answer the required question: "${q.label}" (${domain}).`);
          return;
        }
        if (q.maxWords && typeof val === "string" && countWords(val) > q.maxWords) {
          setActiveDomainTab(domain);
          setError(
            `Answer for "${q.label}" exceeds word cap of ${q.maxWords} words.`,
          );
          return;
        }
      }
    }

    for (const q of WRAP_UP_QUESTIONS) {
      const val = responses[q.id];
      if (q.required && (val === undefined || val === null || String(val).trim() === "")) {
        setError(`Please answer the required question: "${q.label}".`);
        return;
      }
      if (q.maxWords && typeof val === "string" && countWords(val) > q.maxWords) {
        setError(
          `Answer for "${q.label}" exceeds word cap of ${q.maxWords} words.`,
        );
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/recruitment/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domains,
          yearOfStudy,
          branch,
          phone,
          prn: prn.trim(),
          srn: srn.trim() || undefined,
          heardFrom: heardFrom || undefined,
          responses,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Failed to save application.");
        setSaving(false);
        return;
      }

      setSuccess("Application saved successfully!");
      setEditing(false);
      setSaving(false);
      // Smooth scroll to top of application section
      window.scrollTo({ top: document.getElementById("apply")?.offsetTop || 0, behavior: "smooth" });
    } catch {
      setError("A network error occurred. Please try again.");
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "shortlisted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Shortlisted
          </span>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 font-mono text-xs font-semibold text-purple-600 dark:text-purple-400">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
            Offer Extended
          </span>
        );
      case "under_review":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Under Review
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Not Shortlisted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-bronze/30 bg-bronze/10 px-3 py-1 font-mono text-xs font-semibold text-bronze">
            <span className="h-1.5 w-1.5 rounded-full bg-bronze" />
            Application Submitted
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Existing application banner if present */}
      {existingApp && !editing && (
        <MechaPanel
          label="Your Application"
          index={cycle}
          bodyClassName="p-6 sm:p-8 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline pb-6">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-display text-xl font-bold text-chocolate">
                  Application Received
                </h3>
                {getStatusBadge(existingApp.status)}
              </div>
              <p className="mt-1 text-sm text-charcoal/70">
                Applied on {new Date(existingApp.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {existingApp.updatedAt > existingApp.createdAt && ` · Updated ${new Date(existingApp.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
              </p>
            </div>

            {isOpen && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="mecha-btn mecha-btn--solid text-xs self-start sm:self-auto inline-flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                Edit responses
              </button>
            )}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <span className="font-mono text-xs text-bronze uppercase tracking-wider">Candidate</span>
              <p className="mt-1 font-medium text-chocolate">{user.name || user.username} (@{user.username})</p>
              <p className="text-xs text-charcoal/70">{user.email} · {existingApp.phone}</p>
              <p className="text-xs text-charcoal/70">PRN: {user.prn} {user.srn ? `· SRN: ${user.srn}` : ""} · {existingApp.yearOfStudy} Year ({existingApp.branch})</p>
            </div>

            <div>
              <span className="font-mono text-xs text-bronze uppercase tracking-wider">Chosen Domains</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {existingApp.domains.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1 rounded-full border border-hairline bg-panel px-3 py-1 font-mono text-xs font-semibold text-chocolate">
                    <span className="text-bronze font-mono">[{DOMAIN_SHORT_NAMES[d]}]</span> {d}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Submission Details Summary */}
          <div className="space-y-4 pt-4 border-t border-hairline">
            <h4 className="font-display text-sm font-semibold text-chocolate uppercase tracking-wider">
              Submitted Responses
            </h4>
            
            <div className="space-y-4">
              {existingApp.domains.map((domain) => (
                <div key={domain} className="rounded-xl border border-hairline/80 bg-canvas/40 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-bronze">[{DOMAIN_SHORT_NAMES[domain]}]</span>
                    <h5 className="font-medium text-sm text-chocolate">{domain}</h5>
                  </div>
                  <div className="grid gap-3 text-xs">
                    {DOMAIN_QUESTIONS[domain].map((q) => {
                      const ans = existingApp.responses[q.id];
                      return (
                        <div key={q.id} className="space-y-0.5">
                          <p className="text-charcoal/60 font-medium">{q.label}</p>
                          <p className="text-chocolate whitespace-pre-wrap font-mono">
                            {Array.isArray(ans) ? ans.join(", ") : ans != null ? String(ans) : "—"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="rounded-xl border border-hairline/80 bg-canvas/40 p-4 space-y-3">
                <h5 className="font-medium text-sm text-chocolate">Wrapping up</h5>
                <div className="grid gap-3 text-xs">
                  {WRAP_UP_QUESTIONS.map((q) => {
                    const ans = existingApp.responses[q.id];
                    return (
                      <div key={q.id} className="space-y-0.5">
                        <p className="text-charcoal/60 font-medium">{q.label}</p>
                        <p className="text-chocolate whitespace-pre-wrap font-mono">
                          {ans != null ? String(ans) : "—"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </MechaPanel>
      )}

      {/* Interactive Form (New application or Editing mode) */}
      {editing && (
        <form onSubmit={handleSubmit} className="space-y-8">
          {success && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
              {success}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          {/* Step 1: Applicant Profile Information */}
          <MechaPanel
            label="Section 1"
            index="About You"
            bodyClassName="p-6 sm:p-8 space-y-5"
          >
            <div className="border-b border-hairline pb-4">
              <h3 className="font-display text-lg font-bold text-chocolate">
                Personal & Academic Details
              </h3>
              <p className="mt-1 text-xs text-charcoal/70">
                Linked to your verified account (@{user.username}).
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-mono text-charcoal/70 uppercase">Full Name</label>
                <input
                  className={`${inputCls} opacity-80 cursor-not-allowed`}
                  value={user.name || user.username}
                  disabled
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-charcoal/70 uppercase">Email Address</label>
                <input
                  className={`${inputCls} opacity-80 cursor-not-allowed`}
                  value={user.email}
                  disabled
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-charcoal/70 uppercase">
                  PRN (Permanent Registration Number) <span className="text-bronze">*</span>
                </label>
                <input
                  className={inputCls}
                  placeholder="e.g. PES1202400001"
                  value={prn}
                  onChange={(e) => setPrn(e.target.value)}
                  required
                />
                <span className="text-[11px] text-charcoal/60">
                  {user.prn
                    ? "Pre-filled from your profile. You can update it here if needed."
                    : "Permanent Registration Number is required."}
                </span>
              </div>

              <div>
                <label className="block text-xs font-mono text-charcoal/70 uppercase">
                  SRN (Student Registration Number)
                </label>
                <input
                  className={inputCls}
                  placeholder="e.g. PES1UG24CS001"
                  value={srn}
                  onChange={(e) => setSrn(e.target.value)}
                />
                <span className="text-[11px] text-charcoal/60">
                  {user.srn
                    ? "Pre-filled from your profile. You can update it here if needed."
                    : "Leave blank if not assigned yet. Entering it will link it to your account."}
                </span>
              </div>

              <div>
                <label className="block text-xs font-mono text-charcoal/70 uppercase">
                  WhatsApp / Phone Number <span className="text-bronze">*</span>
                </label>
                <input
                  type="tel"
                  className={inputCls}
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
                <span className="text-[11px] text-charcoal/60">
                  {user.phone
                    ? "Pre-filled from your profile. You can update it here if needed."
                    : "Not linked to your account yet. Entering it here will link it to your profile."}
                </span>
              </div>

              <div>
                <label className="block text-xs font-mono text-charcoal/70 uppercase">
                  Year of Study <span className="text-bronze">*</span>
                </label>
                <select
                  className={inputCls}
                  value={yearOfStudy}
                  onChange={(e) => setYearOfStudy(e.target.value)}
                  required
                >
                  {YEAR_OF_STUDY_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y} Year
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-charcoal/70 uppercase">
                  Branch <span className="text-bronze">*</span>
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {BRANCH_OPTIONS.map((b) => {
                    const isSelected =
                      b === "Others"
                        ? !BRANCH_OPTIONS.slice(0, 3).includes(branch) && branch !== ""
                        : branch === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBranch(b === "Others" ? "Other" : b)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                          isSelected
                            ? "bg-bronze text-cream font-bold"
                            : "bg-panel border border-hairline text-charcoal hover:border-bronze"
                        }`}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
                {!BRANCH_OPTIONS.slice(0, 3).includes(branch) && branch !== "" && (
                  <input
                    className={`${inputCls} mt-2 text-xs`}
                    placeholder="Please specify your branch..."
                    value={branch === "Other" ? "" : branch}
                    onChange={(e) => setBranch(e.target.value)}
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-mono text-charcoal/70 uppercase">
                  How did you hear about us?
                </label>
                <select
                  className={inputCls}
                  value={heardFrom}
                  onChange={(e) => setHeardFrom(e.target.value)}
                >
                  <option value="">Select option...</option>
                  {HEARD_FROM_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </MechaPanel>

          {/* Step 2: Domain Choice */}
          <MechaPanel
            label="Section 2"
            index="Domain Selection"
            bodyClassName="p-6 sm:p-8 space-y-5"
          >
            <div className="border-b border-hairline pb-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-chocolate">
                  Which domain(s) are you applying for?
                </h3>
                <span className="font-mono text-xs font-semibold text-bronze">
                  {domains.length}/2 selected
                </span>
              </div>
              <p className="mt-1 text-xs text-charcoal/70">
                You can select up to <strong>2 domains</strong>. Tailored questions will open below for your chosen domain(s).
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {RECRUITMENT_DOMAINS.map((d) => {
                const checked = domains.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleDomainToggle(d)}
                    className={`flex flex-col text-left p-4 rounded-xl border transition-all ${
                      checked
                        ? "border-bronze bg-bronze/10 text-chocolate shadow-sm"
                        : "border-hairline bg-panel hover:border-bronze/50 text-charcoal"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono text-xs font-bold text-bronze">
                        [{DOMAIN_SHORT_NAMES[d]}]
                      </span>
                      <span
                        className={`h-4 w-4 rounded flex items-center justify-center border text-[10px] ${
                          checked
                            ? "bg-bronze text-white border-bronze"
                            : "border-hairline bg-panel"
                        }`}
                      >
                        {checked && "✓"}
                      </span>
                    </div>
                    <span className="mt-2 font-display text-sm font-semibold text-chocolate">
                      {d}
                    </span>
                  </button>
                );
              })}
            </div>
          </MechaPanel>

          {/* Step 3: Domain-specific questions */}
          {domains.length > 0 && (
            <MechaPanel
              label="Section 3"
              index="Domain Questions"
              bodyClassName="p-6 sm:p-8 space-y-6"
            >
              <div className="border-b border-hairline pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-chocolate">
                    Domain-Specific Questions
                  </h3>
                  <p className="mt-1 text-xs text-charcoal/70">
                    Be honest and concise. We evaluate thought process and curiosity over polish.
                  </p>
                </div>

                {domains.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {domains.map((d) => {
                      const currentActive =
                        activeDomainTab && domains.includes(activeDomainTab)
                          ? activeDomainTab
                          : domains[0];
                      const isSelected = currentActive === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setActiveDomainTab(d)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                            isSelected
                              ? "bg-bronze text-white font-bold shadow-sm"
                              : "bg-panel border border-hairline text-charcoal hover:border-bronze hover:text-chocolate"
                          }`}
                        >
                          <span className={isSelected ? "text-white/80 mr-1" : "text-bronze mr-1"}>
                            [{DOMAIN_SHORT_NAMES[d]}]
                          </span>
                          {d}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {domains.map((d) => {
                const currentActive =
                  activeDomainTab && domains.includes(activeDomainTab)
                    ? activeDomainTab
                    : domains[0];
                const isTabActive = currentActive === d;
                if (!isTabActive && domains.length > 1) return null;

                return (
                  <div key={d} className="space-y-6">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-bronze uppercase">
                        Domain Focus:
                      </span>
                      <h4 className="font-display text-base font-bold text-chocolate">
                        {d}
                      </h4>
                    </div>

                    <div className="space-y-5">
                      {DOMAIN_QUESTIONS[d].map((q) => (
                        <RenderQuestionField
                          key={q.id}
                          question={q}
                          value={responses[q.id]}
                          onChange={(val) => handleResponseChange(q.id, val)}
                          onToggleCheckboxOption={(opt) =>
                            handleCheckboxOptionToggle(q.id, opt)
                          }
                        />
                      ))}
                    </div>

                    {domains.length > 1 && (
                      <div className="pt-2 flex justify-end">
                        {domains.indexOf(d) === 0 ? (
                          <button
                            type="button"
                            onClick={() => setActiveDomainTab(domains[1])}
                            className="mecha-btn mecha-btn--ghost text-xs inline-flex items-center gap-1.5"
                          >
                            Continue to {domains[1]} questions ({DOMAIN_SHORT_NAMES[domains[1]]}) &rarr;
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveDomainTab(domains[0])}
                            className="mecha-btn mecha-btn--ghost text-xs inline-flex items-center gap-1.5"
                          >
                            &larr; Back to {domains[0]} questions ({DOMAIN_SHORT_NAMES[domains[0]]})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </MechaPanel>
          )}

          {/* Step 4: Wrapping Up */}
          <MechaPanel
            label="Section 4"
            index="Wrapping Up"
            bodyClassName="p-6 sm:p-8 space-y-6"
          >
            <div className="border-b border-hairline pb-4">
              <h3 className="font-display text-lg font-bold text-chocolate">
                Final Reflections
              </h3>
              <p className="mt-1 text-xs text-charcoal/70">
                Help us understand what you want to achieve during your time with the chapter.
              </p>
            </div>

            <div className="space-y-5">
              {WRAP_UP_QUESTIONS.map((q) => (
                <RenderQuestionField
                  key={q.id}
                  question={q}
                  value={responses[q.id]}
                  onChange={(val) => handleResponseChange(q.id, val)}
                  onToggleCheckboxOption={(opt) =>
                    handleCheckboxOptionToggle(q.id, opt)
                  }
                />
              ))}
            </div>
          </MechaPanel>

          {/* Submit Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            {existingApp && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="mecha-btn mecha-btn--ghost text-xs order-2 sm:order-1"
              >
                Cancel editing
              </button>
            )}

            <button
              type="submit"
              disabled={saving}
              className="mecha-btn mecha-btn--solid text-sm inline-flex items-center gap-2 w-full sm:w-auto ml-auto order-1 sm:order-2"
            >
              {saving ? (
                "Submitting application..."
              ) : existingApp ? (
                <>
                  Update Application
                  <span aria-hidden className="mecha-btn-arrow">&rarr;</span>
                </>
              ) : (
                <>
                  Submit Application
                  <span aria-hidden className="mecha-btn-arrow">&rarr;</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function RenderQuestionField({
  question,
  value,
  onChange,
  onToggleCheckboxOption,
}: {
  question: RecruitmentQuestion;
  value: unknown;
  onChange: (val: unknown) => void;
  onToggleCheckboxOption: (opt: string) => void;
}) {
  const currentText = typeof value === "string" ? value : "";
  const words = countWords(currentText);
  const isOverLimit = question.maxWords ? words > question.maxWords : false;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className="block text-xs font-mono font-medium text-chocolate uppercase">
          {question.label} {question.required && <span className="text-bronze">*</span>}
        </label>
        {question.maxWords && (
          <span
            className={`font-mono text-[11px] ${
              isOverLimit ? "text-rose-500 font-bold" : "text-charcoal/60"
            }`}
          >
            {words}/{question.maxWords} words
          </span>
        )}
      </div>

      {question.help && (
        <p className="text-xs text-charcoal/70">{question.help}</p>
      )}

      {question.contextHtml && (
        <div
          className="my-3"
          dangerouslySetInnerHTML={{ __html: question.contextHtml }}
        />
      )}

      {question.type === "text" && (
        <input
          className={inputCls}
          placeholder={question.placeholder}
          value={currentText}
          onChange={(e) => onChange(e.target.value)}
          required={question.required}
        />
      )}

      {question.type === "textarea" && (
        <textarea
          className={`${inputCls} min-h-[100px] resize-y`}
          placeholder={question.placeholder}
          value={currentText}
          onChange={(e) => onChange(e.target.value)}
          required={question.required}
          rows={4}
        />
      )}

      {question.type === "scale" && (
        <div className="pt-1 pb-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-charcoal/60 px-1 mb-1.5">
            <span>{question.scaleMinLabel || "1 - Least Proficient"}</span>
            <span>{question.scaleMaxLabel || "5 - Most Proficient"}</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((num) => {
              const checked = Number(value) === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => onChange(num)}
                  className={`py-2 rounded-xl text-center text-xs font-mono font-bold border transition-all ${
                    checked
                      ? "bg-bronze text-cream border-bronze shadow-sm"
                      : "bg-panel border-hairline text-charcoal hover:border-bronze"
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {question.type === "choice" && question.options && (
        <div className="flex flex-wrap gap-2 pt-1">
          {question.options.map((opt) => {
            const checked = value === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  checked
                    ? "bg-bronze text-cream font-bold"
                    : "bg-panel border border-hairline text-charcoal hover:border-bronze"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {question.type === "checks" && question.options && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
          {question.options.map((opt) => {
            const selected: string[] = Array.isArray(value) ? value : [];
            const isChecked = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onToggleCheckboxOption(opt)}
                className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs font-mono border transition-all ${
                  isChecked
                    ? "border-bronze bg-bronze/10 text-chocolate font-medium"
                    : "border-hairline bg-panel text-charcoal hover:border-bronze/60"
                }`}
              >
                <span
                  className={`h-3.5 w-3.5 rounded flex items-center justify-center border text-[9px] ${
                    isChecked
                      ? "bg-bronze text-cream border-bronze"
                      : "border-hairline bg-panel"
                  }`}
                >
                  {isChecked && "✓"}
                </span>
                <span className="truncate">{opt}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
