"use client"

function MoonIcon({ className, strokeWidth = 2 }: { className?: string, strokeWidth?: number }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon({ className, strokeWidth = 2 }: { className?: string, strokeWidth?: number }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

interface ThemeToggleProps {
  className?: string
  onToggle: (event: React.MouseEvent) => void
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export function ThemeToggle({ className, onToggle }: ThemeToggleProps) {
  return (
    <div
      className={cn(
        "relative flex w-[60px] h-8 p-1 rounded-full cursor-pointer shadow-sm backdrop-blur transition-all duration-300",
        "bg-white/70 border border-[#e2e8f0]",
        "dark:bg-[#221a12]/80 dark:border-[#3a2c20]",
        className
      )}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle(e as unknown as React.MouseEvent);
        }
      }}
      role="button"
      tabIndex={0}
      title="Toggle dark mode"
      aria-label="Toggle dark mode"
    >
      <div className="flex justify-between items-center w-full relative h-full">
        {/* The sliding circle indicator */}
        <div className={cn(
          "absolute left-0 top-0 flex justify-center items-center w-6 h-6 rounded-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "bg-white shadow-sm border border-[#e2e8f0]",
          "dark:translate-x-[26px] dark:bg-[#3a2c20] dark:border-[#5b4638] dark:shadow-none"
        )}>
          {/* Light mode sun */}
          <SunIcon className="text-[#3e2f24] dark:hidden" strokeWidth={2.5} />
          {/* Dark mode moon */}
          <MoonIcon className="text-[#f7f0e6] hidden dark:block" strokeWidth={2.5} />
        </div>
      </div>
    </div>
  )
}
