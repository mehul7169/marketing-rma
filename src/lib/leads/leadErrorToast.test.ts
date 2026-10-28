import { describe, expect, it } from "vitest";
import { leadErrorToast } from "@/lib/leads/leadErrorToast";

describe("leadErrorToast", () => {
  it("prefixes the lead name", () => {
    expect(
      leadErrorToast(
        { name: "Kunal Jiwani", email: "k@example.com" },
        "Book a call before marking it as showed."
      )
    ).toBe("Kunal Jiwani: Book a call before marking it as showed.");
  });

  it("falls back to email, then Lead", () => {
    expect(leadErrorToast({ name: "  ", email: "k@example.com" }, "Nope")).toBe(
      "k@example.com: Nope"
    );
    expect(leadErrorToast({}, "Nope")).toBe("Lead: Nope");
  });
});
