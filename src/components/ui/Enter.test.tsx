import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { reduced } = vi.hoisted(() => ({ reduced: { current: false } }));

vi.mock("@/lib/motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/motion")>();
  return { ...actual, MOTION_OFF: false };
});

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    useReducedMotion: () => reduced.current
  };
});

import { FadeIn, EnterStagger } from "@/components/ui/Enter";
import { resetFirstEnter } from "@/lib/motion";

beforeEach(() => {
  reduced.current = false;
  resetFirstEnter();
});

function wrapperStyle(el: HTMLElement) {
  return el.closest("div")?.getAttribute("style") ?? "";
}

describe("FadeIn", () => {
  it("ends visible after mount with motion on", async () => {
    render(
      <FadeIn id="fade-visible">
        <span>Table body</span>
      </FadeIn>
    );
    const text = await screen.findByText("Table body");
    await waitFor(() => {
      expect(wrapperStyle(text)).toMatch(/opacity:\s*1/);
    });
  });

  it("stays visible when remounted after first enter was consumed", async () => {
    const { unmount } = render(
      <FadeIn id="fade-once">
        <span>First</span>
      </FadeIn>
    );
    unmount();
    render(
      <FadeIn id="fade-once">
        <span>Second</span>
      </FadeIn>
    );
    const text = await screen.findByText("Second");
    await waitFor(() => {
      expect(wrapperStyle(text)).toMatch(/opacity:\s*1/);
    });
  });

  it("renders visible immediately under reduced motion", () => {
    reduced.current = true;
    render(
      <FadeIn id="fade-reduced">
        <span>Reduced</span>
      </FadeIn>
    );
    expect(wrapperStyle(screen.getByText("Reduced"))).toMatch(/opacity:\s*1/);
  });
});

describe("EnterStagger", () => {
  it("does not leave children at opacity 0", async () => {
    render(
      <EnterStagger id="stagger-visible">
        <span>Card A</span>
        <span>Card B</span>
      </EnterStagger>
    );
    await waitFor(() => {
      expect(wrapperStyle(screen.getByText("Card A"))).toMatch(/opacity:\s*1/);
      expect(wrapperStyle(screen.getByText("Card B"))).toMatch(/opacity:\s*1/);
    });
  });
});
