import { describe, expect, it } from "vitest";
import {
  THEME_COOKIE,
  THEME_INIT_SCRIPT,
  parseThemePreference,
  resolveTheme
} from "@/lib/ui/theme";

describe("theme preference", () => {
  it("defaults unknown values to system", () => {
    expect(parseThemePreference(undefined)).toBe("system");
    expect(parseThemePreference(null)).toBe("system");
    expect(parseThemePreference("sepia")).toBe("system");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("system")).toBe("system");
  });

  it("resolves system from the OS flag", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("ships a blocking init script that reads the cookie and sets data-theme", () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_COOKIE);
    expect(THEME_INIT_SCRIPT).toContain("data-theme");
    expect(THEME_INIT_SCRIPT).toContain("prefers-color-scheme: dark");
    expect(THEME_INIT_SCRIPT).toContain("colorScheme");
  });
});
