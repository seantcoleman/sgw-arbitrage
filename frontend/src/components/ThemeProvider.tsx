"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/** Resolved appearance applied to the document. */
export type Theme = "light" | "dark";
/** Stored preference — `auto` follows local time of day (default until the user toggles). */
export type ThemePreference = "light" | "dark" | "auto";

const STORAGE_KEY = "theme";
/** Local hour [0–23]: light from DAY_START (inclusive) until DAY_END (exclusive). */
const DAY_START = 6;
const DAY_END = 19;

const ThemeContext = createContext<{
  theme: Theme;
  preference: ThemePreference;
  toggleTheme: () => void;
}>({
  theme: "light",
  preference: "auto",
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function themeFromTime(date = new Date()): Theme {
  const hour = date.getHours();
  return hour >= DAY_START && hour < DAY_END ? "light" : "dark";
}

function readStoredPreference(): ThemePreference | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "auto") return raw;
  } catch {
    /* ignore */
  }
  return null;
}

function resolveTheme(preference: ThemePreference): Theme {
  return preference === "auto" ? themeFromTime() : preference;
}

function applyDomTheme(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>("auto");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = readStoredPreference() ?? "auto";
    const resolved = resolveTheme(stored);
    setPreference(stored);
    setTheme(resolved);
    applyDomTheme(resolved);
  }, []);

  // When on auto, re-check around sunrise/sunset hour boundaries
  useEffect(() => {
    if (preference !== "auto") return;
    const tick = () => {
      const next = themeFromTime();
      setTheme(prev => {
        if (prev === next) return prev;
        applyDomTheme(next);
        return next;
      });
    };
    const id = window.setInterval(tick, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [preference]);

  /** Always flips the visible theme. Leaving auto locks in an explicit choice. */
  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyDomTheme(next);
      setPreference(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore quota / private mode */
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, preference, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
