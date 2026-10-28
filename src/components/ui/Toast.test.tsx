import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Toaster,
  resetToasts,
  toastError,
  toastSuccess
} from "@/components/ui/Toast";

beforeEach(() => {
  vi.useFakeTimers();
  resetToasts();
});
afterEach(() => {
  vi.useRealTimers();
  resetToasts();
});

describe("Toaster", () => {
  it("stacks at most 3 errors, bottom-left, and auto-dismisses after 4s", () => {
    render(<Toaster />);
    act(() => {
      toastError("one");
      toastError("two");
      toastError("three");
      toastError("four");
    });
    const stack = screen.getByTestId("toast-stack");
    expect(stack.className).toMatch(/bottom-4/);
    expect(stack.className).toMatch(/left-4/);
    expect(screen.getAllByTestId("toast-error")).toHaveLength(3);
    expect(screen.queryByText("one")).not.toBeInTheDocument();
    expect(screen.getByText("four")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByTestId("toast-stack")).not.toBeInTheDocument();
  });

  it("dismisses success toasts after 3s", () => {
    render(<Toaster />);
    act(() => {
      toastSuccess("saved");
    });
    expect(screen.getByTestId("toast-success")).toHaveTextContent("saved");
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByTestId("toast-success")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId("toast-stack")).not.toBeInTheDocument();
  });
});
