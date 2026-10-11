"use client";

import { useEffect, useState, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import AppLink from "@/components/AppLink";
import { formatCodeForDisplay } from "@/lib/algohunt/codes";
import type { AhCodeBatch } from "@/server/db/schema";
import type { CodeStatus } from "@/lib/algohunt/types";

interface BatchPrintData {
  batch: AhCodeBatch;
  codes: { serial: number; code: string; status: CodeStatus }[];
}

export default function PrintSheet({ batchId }: { batchId: string }) {
  const [data, setData] = useState<BatchPrintData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCodeText, setShowCodeText] = useState(true);
  const [includeDisabled, setIncludeDisabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchBatch() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/algohunt/codes/batches/${encodeURIComponent(batchId)}/print`, {
          cache: "no-store",
        });
        const json = await res.json() as { ok: boolean; batch?: AhCodeBatch; codes?: { serial: number; code: string; status: CodeStatus }[]; error?: string };
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setError(json.error ?? "Failed to load batch data.");
        } else if (json.batch && json.codes) {
          setData({ batch: json.batch, codes: json.codes });
        }
      } catch {
        if (!cancelled) setError("Network error loading print sheet.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchBatch();
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const filteredCodes = useMemo(() => {
    if (!data) return [];
    if (includeDisabled) return data.codes;
    return data.codes.filter((c) => c.status === "ACTIVE");
  }, [data, includeDisabled]);

  // Chunk into 20 items per A4 sheet (4 columns x 5 rows)
  const pages = useMemo(() => {
    const CARDS_PER_PAGE = 20;
    const result: typeof filteredCodes[] = [];
    for (let i = 0; i < filteredCodes.length; i += CARDS_PER_PAGE) {
      result.push(filteredCodes.slice(i, i + CARDS_PER_PAGE));
    }
    return result;
  }, [filteredCodes]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-bronze" />
        <p className="font-mono text-sm text-charcoal/70">Loading batch #{batchId} for printing...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-700 dark:text-red-300 space-y-3">
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="w-5 h-5" />
            <span>Failed to load print sheet</span>
          </div>
          <p className="text-sm">{error || "Batch not found."}</p>
          <AppLink href="/admin/algohunt/codes" className="mecha-btn mecha-btn--ghost text-xs inline-flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back to Codes
          </AppLink>
        </div>
      </div>
    );
  }

  return (
    <div className="print:bg-white print:text-black">
      {/* Top Banner & Controls (Hidden in Print) */}
      <div className="print:hidden space-y-4 mb-6">
        {/* Security Warning Banner */}
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/15 p-4 flex items-center justify-between gap-4 text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">Contains live codes. Print, then close this tab.</p>
          </div>
          <AppLink
            href="/admin/algohunt/codes"
            className="text-xs font-mono underline hover:text-amber-950 dark:hover:text-amber-100 shrink-0"
          >
            Done printing
          </AppLink>
        </div>

        {/* Toolbar */}
        <div className="lc-panel p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppLink
              href="/admin/algohunt/codes"
              className="mecha-btn mecha-btn--ghost mecha-btn--sm inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </AppLink>
            <div>
              <h1 className="font-display text-lg font-bold text-chocolate">
                Batch: {data.batch.name}
              </h1>
              <p className="text-xs text-charcoal/60 font-mono">
                {filteredCodes.length} {filteredCodes.length === 1 ? "code" : "codes"} · {pages.length} {pages.length === 1 ? "page" : "pages"} (4 × 5 per A4 sheet)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={showCodeText}
                onChange={(e) => setShowCodeText(e.target.checked)}
                className="h-4 w-4 rounded border-hairline text-bronze focus:ring-bronze"
              />
              <span>Show code text under QR</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={includeDisabled}
                onChange={(e) => setIncludeDisabled(e.target.checked)}
                className="h-4 w-4 rounded border-hairline text-bronze focus:ring-bronze"
              />
              <span>Include disabled codes</span>
            </label>

            <button
              type="button"
              onClick={() => window.print()}
              className="mecha-btn mecha-btn--solid inline-flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> Print Sheet
            </button>
          </div>
        </div>
      </div>

      {/* Printable Pages */}
      {filteredCodes.length === 0 ? (
        <div className="p-12 text-center text-charcoal/60 font-mono text-sm print:hidden">
          No codes available to print.
        </div>
      ) : (
        <div className="space-y-8 print:space-y-0">
          {pages.map((pageCodes, pageIndex) => (
            <div
              key={pageIndex}
              className="print-page bg-white text-black p-4 border border-hairline print:border-0 rounded-xl print:rounded-none shadow-sm print:shadow-none mx-auto max-w-[210mm] print:max-w-none print:w-full print:p-0 print:m-0"
              style={{ minHeight: "270mm" }}
            >
              {/* 4 columns x 5 rows grid */}
              <div className="grid grid-cols-4 grid-rows-5 gap-2 print:gap-1.5 h-full">
                {pageCodes.map((item) => (
                  <div
                    key={item.serial}
                    className="border border-dashed border-neutral-400 print:border-black p-2 flex flex-col items-center justify-between text-center rounded print:rounded-none bg-white"
                    style={{ minHeight: "52mm" }}
                  >
                    {/* Header */}
                    <div className="w-full flex items-center justify-between text-[9px] font-mono font-bold tracking-tight text-neutral-700 print:text-black">
                      <span>ALGOHUNT 2.0</span>
                      <span>#{String(item.serial).padStart(3, "0")}</span>
                    </div>

                    {/* QR Code */}
                    <div className="my-auto py-1 flex items-center justify-center">
                      <QRCodeSVG
                        value={item.code}
                        size={135}
                        level="M"
                        marginSize={0}
                      />
                    </div>

                    {/* Code Text Under QR */}
                    {showCodeText && (
                      <div className="font-mono text-xs font-bold tracking-wider text-black my-0.5">
                        {formatCodeForDisplay(item.code)}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="text-[7.5px] leading-tight text-neutral-600 print:text-black font-sans">
                      Scan · enter the code in the Arena · first team wins it
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Global Print CSS */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print-page {
            page-break-after: always;
            break-after: page;
          }
          .print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}
