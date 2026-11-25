"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { MotionConfig } from "motion/react";
import { DURATION, EASE_OUT } from "@/lib/motion";
import {
  applyResolvedTheme,
  persistThemePreference,
  readStoredThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference
} from "@/lib/ui/theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  const apply = useCallback((pref: ThemePreference) => {
    const next = resolveTheme(pref, systemPrefersDark());
    applyResolvedTheme(next);
    setResolved(next);
  }, []);

  useEffect(() => {
    const pref = readStoredThemePreference();
    setPreferenceState(pref);
    apply(pref);
  }, [apply]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (preference === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference, apply]);

  const setPreference = useCallback(
    (pref: ThemePreference) => {
      setPreferenceState(pref);
      persistThemePreference(pref);
      apply(pref);
    },
    [apply]
  );

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference]
  );

  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ ease: EASE_OUT, duration: DURATION.base }}
    >
      <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    </MotionConfig>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
