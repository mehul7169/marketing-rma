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
  beforeEach(() => {
    signInWithPassword.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign: vi.fn() }
    });
  });

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
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("disables submit and shows pending label while signing in", async () => {
    let resolveSignIn!: (value: { error: null }) => void;
    signInWithPassword.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve;
        })
    );
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "secret12");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const pending = screen.getByRole("button", { name: "Signing in…" });
    expect(pending).toBeDisabled();
    expect(screen.getByLabelText("Email")).toBeDisabled();

    resolveSignIn({ error: null });
    await vi.waitFor(() =>
      expect(window.location.assign).toHaveBeenCalledWith("/")
    );
  });

  it("ignores rapid duplicate clicks while sign-in is in flight", async () => {
    let resolveSignIn!: (value: { error: null }) => void;
    signInWithPassword.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve;
        })
    );
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "secret12");
    const button = screen.getByRole("button", { name: "Sign in" });
    await user.click(button);
    await user.click(button);
    await user.click(button);

    expect(signInWithPassword).toHaveBeenCalledTimes(1);

    resolveSignIn({ error: null });
    await vi.waitFor(() =>
      expect(window.location.assign).toHaveBeenCalledWith("/")
    );
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
  const orgs = [
    { id: "org-1", name: "RMA", slug: "rma" },
    { id: "org-2", name: "Acme", slug: "acme" }
  ];

  it("rejects non-numeric Meta ID before calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AddClientAdAccountForm organizations={orgs} />);

    await user.click(screen.getByRole("button", { name: "Add Ad Account" }));
    await user.selectOptions(screen.getByLabelText("Organization"), "org-1");
    await user.type(screen.getByPlaceholderText("539253822308075"), "not-a-number");
    await user.click(screen.getByRole("button", { name: "Add account" }));

    expect(
      await screen.findByText("Enter just the numeric ID, without act_")
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires an organization before submit", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AddClientAdAccountForm organizations={orgs} />);

    await user.click(screen.getByRole("button", { name: "Add Ad Account" }));
    await user.type(screen.getByPlaceholderText("539253822308075"), "539253822308075");
    await user.click(screen.getByRole("button", { name: "Add account" }));

    expect(
      await screen.findByText("Select an organization or create a new one")
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a name when creating a new organization", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AddClientAdAccountForm organizations={orgs} />);

    await user.click(screen.getByRole("button", { name: "Add Ad Account" }));
    await user.selectOptions(
      screen.getByLabelText("Organization"),
      "__create_new__"
    );
    await user.type(screen.getByPlaceholderText("539253822308075"), "539253822308075");
    await user.click(screen.getByRole("button", { name: "Add account" }));

    expect(
      await screen.findByText("Enter a name for the new organization")
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts orgId when an existing organization is selected", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        account: { id: "acc-1" }
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AddClientAdAccountForm organizations={orgs} />);

    await user.click(screen.getByRole("button", { name: "Add Ad Account" }));
    await user.selectOptions(screen.getByLabelText("Organization"), "org-2");
    await user.type(screen.getByPlaceholderText("539253822308075"), "539253822308075");
    await user.click(screen.getByRole("button", { name: "Add account" }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      metaAdAccountId: "539253822308075",
      orgId: "org-2"
    });
  });
});
