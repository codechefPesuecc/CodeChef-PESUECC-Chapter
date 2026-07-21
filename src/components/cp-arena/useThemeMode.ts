"use client";

import { useEffect, useState } from "react";

/**
 * Tracks the active site theme (the `.dark` class the Navbar toggle sets on
 * <html>) and updates reactively when it changes. Used to keep the CodeMirror
 * editor in sync with light/dark mode. Only ever runs on the client (the editor
 * is loaded with `ssr: false`), so the lazy initializer can read the DOM safely.
 */
export function useThemeMode(): "light" | "dark" {
  const [mode, setMode] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
      ? "dark"
      : "light",
  );

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setMode(root.classList.contains("dark") ? "dark" : "light");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return mode;
}
