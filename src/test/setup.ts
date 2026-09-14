import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// react.cache is a no-op in Vitest — passthrough preserves call semantics.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn
  };
});
