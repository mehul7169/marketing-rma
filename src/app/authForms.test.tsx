import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const signInWithPassword = vi.fn();
const signUp = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword, signUp }
  })
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() })
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>
}));

import LoginPage from "@/app/login/page";
import SignupPage from "@/app/signup/page";
import AddClientAdAccountForm from "@/components/clients/AddClientAdAccountForm";

describe("Login form", () => {
  it("shows auth error from Supabase without succeeding", async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" }
    });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "secret12");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Invalid email or password")
    ).toBeInTheDocument();
    expect(signInWithPassword).toHaveBeenCalled();
  });
});

describe("Signup form validation", () => {
  it("rejects mismatched passwords without calling Supabase", async () => {
    const user = userEvent.setup();
    render(<SignupPage />);

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "secret12");
    await user.type(screen.getByLabelText("Confirm password"), "other12");
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("rejects short passwords without calling Supabase", async () => {
    const user = userEvent.setup();
    render(<SignupPage />);

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "abc");
    await user.type(screen.getByLabelText("Confirm password"), "abc");
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    expect(
      await screen.findByText("Password must be at least 6 characters")
    ).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });
});

describe("AddClientAdAccountForm validation", () => {
  it("rejects non-numeric Meta ID before calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AddClientAdAccountForm />);

    await user.click(screen.getByRole("button", { name: "Add Ad Account" }));
    await user.type(screen.getByPlaceholderText("539253822308075"), "not-a-number");
    await user.click(screen.getByRole("button", { name: "Add account" }));

    expect(
      await screen.findByText("Enter just the numeric ID, without act_")
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
