export const THEME_COOKIE = "theme";
export const THEME_STORAGE_KEY = "theme";
export const THEME_MAX_AGE = 60 * 60 * 24 * 365;

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_PREFERENCES: ThemePreference[] = ["light", "dark", "system"];

export function parseThemePreference(
  raw: string | null | undefined
): ThemePreference {
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean
): ResolvedTheme {
  if (preference === "system") return systemDark ? "dark" : "light";
  return preference;
}

export function persistThemePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // ignore quota / private mode
  }
  const secure =
    typeof location !== "undefined" && location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${THEME_COOKIE}=${encodeURIComponent(preference)}; Path=/; Max-Age=${THEME_MAX_AGE}; SameSite=Lax${secure}`;
}

export function readStoredThemePreference(): ThemePreference {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // ignore
  }
  if (!stored && typeof document !== "undefined") {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`)
    );
    stored = match?.[1] ? decodeURIComponent(match[1]) : null;
  }
  return parseThemePreference(stored);
}

export function applyResolvedTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;
}

/** Blocking <head> script: sets data-theme before first paint. Keep in sync with the helpers above. */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var pref=null;try{pref=localStorage.getItem(k)}catch(e){}if(pref!=="light"&&pref!=="dark"&&pref!=="system"){var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);pref=m?decodeURIComponent(m[1]):"system"}if(pref!=="light"&&pref!=="dark"&&pref!=="system")pref="system";var dark=pref==="dark"||(pref==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var t=dark?"dark":"light";var r=document.documentElement;r.setAttribute("data-theme",t);r.style.colorScheme=t}catch(e){}})();`;
