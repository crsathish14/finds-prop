// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/i18n/messages/en.json";
import type { SessionView } from "@/server/auth/session";

const state = vi.hoisted(() => ({
  session: null as SessionView | null,
  sessionFails: false,
  summary: { fullName: "Priya Raman", email: "priya@example.com" } as {
    fullName: string | null;
    email: string | null;
  },
  menu: [] as Record<string, unknown>[],
  drawer: [] as Record<string, unknown>[],
  signOutButtons: [] as Record<string, unknown>[],
  warnings: [] as unknown[][],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/get-session-view", () => ({
  getSessionView: async () => {
    if (state.sessionFails) throw new Error("roles unreadable");
    return state.session;
  },
}));
vi.mock("@/server/logger", () => ({
  logger: { warn: (...args: unknown[]) => state.warnings.push(args) },
}));
vi.mock("@/features/auth", () => ({
  getAccountSummary: async () => state.summary,
  AccountMenu: (props: Record<string, unknown>) => {
    state.menu.push(props);
    return <div data-testid="account-menu" />;
  },
  SignOutButton: (props: Record<string, unknown>) => {
    state.signOutButtons.push(props);
    return <div data-testid="sign-out-button" />;
  },
}));
vi.mock("../account-drawer.client", () => ({
  AccountDrawer: (props: Record<string, unknown> & { trailing?: ReactNode }) => {
    state.drawer.push(props);
    return <div data-testid="drawer">{props.trailing}</div>;
  },
}));
vi.mock("../sign-in-link.client", () => ({
  SignInLink: ({ label }: { label: string }) => <span data-testid="sign-in-link">{label}</span>,
}));
vi.mock("../translator", () => ({
  getTranslate: async () => (key: string, values?: Record<string, string | number>) => {
    let node: unknown = messages;
    for (const part of key.split(".")) node = (node as Record<string, unknown>)[part];
    if (typeof node !== "string") throw new Error(`missing message ${key}`);
    return node.replace(/\{(\w+)\}/g, (_match, name: string) => String(values?.[name] ?? ""));
  },
}));

const { HeaderAccountActions, HeaderAccountDrawer } = await import("../header-account");

const customer: SessionView = {
  userId: "user-1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};
const admin: SessionView = { ...customer, roles: ["super_admin", "customer"] };
const builder: SessionView = { ...customer, roles: ["builder", "customer"], builderId: "record-1" };

const links = [
  { label: "Buy", href: "/properties" },
  { label: "AI Search", href: "/ai-search", accent: true },
];
const cta = { label: "Post property", href: "/post-property" };

async function renderActions() {
  render(await HeaderAccountActions());
}

async function renderDrawer() {
  render(await HeaderAccountDrawer({ links, cta }));
}

beforeEach(() => {
  state.session = null;
  state.sessionFails = false;
  state.summary = { fullName: "Priya Raman", email: "priya@example.com" };
  state.menu = [];
  state.drawer = [];
  state.signOutButtons = [];
  state.warnings = [];
});

describe("HeaderAccountActions: the right side of the header", () => {
  it("shows Sign in to a visitor, and no account menu", async () => {
    await renderActions();
    expect(screen.getByTestId("sign-in-link")).toHaveTextContent("Sign in");
    expect(screen.queryByTestId("account-menu")).not.toBeInTheDocument();
  });

  it("shows the saved link and the account menu with the name, email and initials", async () => {
    state.session = customer;
    await renderActions();
    expect(screen.getByRole("link", { name: "Saved homes" })).toHaveAttribute(
      "href",
      "/dashboard?tab=saved",
    );
    expect(state.menu[0]).toMatchObject({
      triggerLabel: "Account menu",
      name: "Priya Raman",
      email: "priya@example.com",
      initials: "PR",
      roleTone: "default",
      signOut: {
        label: "Sign out",
        failedText: "We couldn't sign you out. Please try again.",
        destination: "/",
      },
    });
    expect(state.menu[0]).not.toHaveProperty("roleLabel");
  });

  it("sends an administrator to the admin sign-in page on Sign out, with the admin role shown", async () => {
    state.session = admin;
    await renderActions();
    expect(state.menu[0]).toMatchObject({
      roleLabel: "Admin",
      roleTone: "admin",
      signOut: { destination: "/admin/login" },
    });
  });

  it("calls an account with no name yet 'Your account', with no initials and no email", async () => {
    state.session = customer;
    state.summary = { fullName: null, email: null };
    await renderActions();
    expect(state.menu[0]).toMatchObject({ name: "Your account", initials: "" });
    expect(state.menu[0]).not.toHaveProperty("email");
  });

  it("treats a name of only spaces as no name", async () => {
    state.session = customer;
    state.summary = { fullName: "   ", email: null };
    await renderActions();
    expect(state.menu[0]).toMatchObject({ name: "Your account", initials: "" });
  });

  it("shows the signed-out look and logs when the roles cannot be read, instead of breaking the page", async () => {
    state.sessionFails = true;
    await renderActions();
    expect(screen.getByTestId("sign-in-link")).toHaveTextContent("Sign in");
    expect(state.warnings).toHaveLength(1);
    expect(JSON.stringify(state.warnings)).not.toContain("roles unreadable");
  });
});

describe("HeaderAccountDrawer: the menu button and drawer", () => {
  it("gives a visitor Sign in and Post property, and no account links", async () => {
    await renderDrawer();
    expect(state.drawer[0]).toMatchObject({
      labels: { trigger: "Open menu", title: "Menu", close: "Close menu" },
      links,
      groups: [],
      actions: [
        { label: "Sign in", href: "/auth", variant: "secondary" },
        { label: "Post property", href: "/post-property", variant: "accent" },
      ],
    });
    expect(screen.queryByTestId("sign-out-button")).not.toBeInTheDocument();
  });

  it("gives a signed-in person their account links, Post property and a Sign out button", async () => {
    state.session = customer;
    await renderDrawer();
    const props = state.drawer[0] as {
      groups: { label?: string; entries: { label: string; href: string }[] }[];
      actions: { label: string }[];
    };
    expect(props.groups.map((group) => group.label)).toEqual(["Your account"]);
    expect(props.groups[0]?.entries.map((entry) => entry.label)).toEqual([
      "Saved homes",
      "My listings",
      "Enquiries received",
      "My enquiries",
    ]);
    expect(props.actions).toEqual([
      { label: "Post property", href: "/post-property", variant: "accent" },
    ]);
    expect(screen.getByTestId("sign-out-button")).toBeInTheDocument();
    expect(state.signOutButtons[0]).toMatchObject({ label: "Sign out", destination: "/" });
  });

  it("adds the Workspaces group for a builder, who signs out to the builder page", async () => {
    state.session = builder;
    await renderDrawer();
    const props = state.drawer[0] as {
      groups: { label?: string; entries: { label: string }[] }[];
    };
    expect(props.groups.map((group) => group.label)).toEqual(["Your account", "Workspaces"]);
    expect(props.groups[1]?.entries.map((entry) => entry.label)).toEqual(["Builder portal"]);
    expect(state.signOutButtons[0]).toMatchObject({ destination: "/builder/login" });
  });

  it("leaves out the Post property button when the header has none", async () => {
    render(await HeaderAccountDrawer({ links, cta: undefined }));
    expect((state.drawer[0] as { actions: unknown[] }).actions).toEqual([
      { label: "Sign in", href: "/auth", variant: "secondary" },
    ]);
  });
});
