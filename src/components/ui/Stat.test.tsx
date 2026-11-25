import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatCurrency,
  formatInteger,
  formatPercent
} from "@/lib/format";

const { reduced } = vi.hoisted(() => ({ reduced: { current: false } }));

vi.mock("@/lib/motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/motion")>();
  return { ...actual, MOTION_OFF: false };
});

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    useReducedMotion: () => reduced.current,
    animate: (
      _from: number,
      to: number,
      opts: {
        onUpdate?: (v: number) => void;
        onComplete?: () => void;
      }
    ) => {
      opts.onUpdate?.(to);
      opts.onComplete?.();
      return { stop: () => {} };
    }
  };
});

import Stat from "@/components/ui/Stat";

beforeEach(() => {
  reduced.current = false;
});

describe("Stat count-up", () => {
  it("reaches the exact formatted currency value", () => {
    render(
      <Stat label="Revenue" value={68255} format={formatCurrency} />
    );
    expect(screen.getByTestId("count-up")).toHaveTextContent("₹68,255");
  });

  it("reaches the exact formatted percent value", () => {
    render(
      <Stat label="CTR" value={3.45} format={formatPercent} />
    );
    expect(screen.getByTestId("count-up")).toHaveTextContent("3.45%");
  });

  it("reaches the exact formatted integer value", () => {
    render(
      <Stat label="Leads" value={9322} format={formatInteger} />
    );
    expect(screen.getByTestId("count-up")).toHaveTextContent("9,322");
  });

  it("renders the final value immediately when reduced motion is on", () => {
    reduced.current = true;
    render(
      <Stat label="Revenue" value={68255} format={formatCurrency} />
    );
    expect(screen.getByTestId("count-up")).toHaveTextContent("₹68,255");
  });
});
