"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import type { LanguageOption } from "@/lib/algohunt/types";

/** "C++ (g++ 20)" → { name: "C++", runtime: "g++ 20" }. */
function splitLabel(label: string): { name: string; runtime: string | null } {
  const match = /^(.*?)\s*\((.+)\)\s*$/.exec(label);
  return match ? { name: match[1], runtime: match[2] } : { name: label, runtime: null };
}

/**
 * Language dropdown for the editor toolbar. The list renders in a portal on document.body, so the
 * editor panel's overflow can't clip it, and it follows the AlgoHunt theme instead of the OS menu.
 */
export default function LanguagePicker({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: string;
  options: LanguageOption[];
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const listId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const current = options.find((option) => option.id === value) ?? options[0];
  const currentLabel = splitLabel(current?.label ?? value);

  const openList = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ top: rect.bottom + 4, left: rect.left, minWidth: Math.max(rect.width, 220) });
    setActive(Math.max(0, options.findIndex((option) => option.id === value)));
    setOpen(true);
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const choose = (index: number) => {
    const option = options[index];
    if (option && option.id !== value) onChange(option.id);
    close(true);
  };

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!listRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    // The list is positioned once; close it rather than let it drift away from the button.
    const onMove = () => setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === "ArrowDown") setActive((i) => Math.min(options.length - 1, i + 1));
    else if (event.key === "ArrowUp") setActive((i) => Math.max(0, i - 1));
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(options.length - 1);
    else if (event.key === "Enter" || event.key === " ") choose(active);
    else if (event.key === "Escape" || event.key === "Tab") close(event.key === "Escape");
    else return;
    event.preventDefault();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Language: ${current?.label ?? value}. Change language`}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            openList();
          }
        }}
        className="group inline-flex h-8 min-w-0 max-w-[240px] items-center gap-2 rounded-md border border-hairline bg-panel py-1.5 pl-3 pr-2 text-left text-xs font-semibold text-chocolate transition-colors hover:border-bronze/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze disabled:cursor-not-allowed disabled:opacity-60 dark:text-cream"
      >
        <span className="truncate">{currentLabel.name}</span>
        {currentLabel.runtime && (
          <span className="hidden truncate rounded bg-bronze/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-bronze sm:inline">
            {currentLabel.runtime}
          </span>
        )}
        <ChevronDown
          aria-hidden
          className={`ml-auto h-3.5 w-3.5 shrink-0 text-charcoal/50 transition-transform dark:text-cream/50 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && position && createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label="Programming language"
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKeyDown}
          style={{ top: position.top, left: position.left, minWidth: position.minWidth }}
          className="fixed z-[900] max-h-[min(60vh,360px)] overflow-y-auto rounded-lg border border-hairline bg-panel p-1 shadow-xl outline-none"
        >
          {options.map((option, index) => {
            const label = splitLabel(option.label);
            const selected = option.id === value;
            return (
              <li
                key={option.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected}
                onPointerEnter={() => setActive(index)}
                onClick={() => choose(index)}
                className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm ${
                  index === active ? "bg-bronze/10" : ""
                } ${selected ? "font-semibold text-bronze" : "text-chocolate dark:text-cream"}`}
              >
                <span className="flex-1">{label.name}</span>
                {label.runtime && (
                  <span className="font-mono text-[11px] text-charcoal/50 dark:text-cream/50">{label.runtime}</span>
                )}
                <Check aria-hidden className={`h-3.5 w-3.5 ${selected ? "opacity-100" : "opacity-0"}`} />
              </li>
            );
          })}
        </ul>,
        document.body,
      )}
    </>
  );
}
