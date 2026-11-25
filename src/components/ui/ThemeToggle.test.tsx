import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import ThemeToggle from "@/components/ui/ThemeToggle";

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle collapsed={false} />
    </ThemeProvider>
  );
}

describe("ThemeToggle", () => {
  it("exposes a radiogroup and switches Light / Dark / System", async () => {
    const user = userEvent.setup();
    renderToggle();
    const group = await screen.findByRole("radiogroup", { name: "Theme" });
    expect(group).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.cookie).toMatch(/(?:^|; )theme=dark(?:;|$)/);

    await user.click(screen.getByRole("radio", { name: "Light" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
