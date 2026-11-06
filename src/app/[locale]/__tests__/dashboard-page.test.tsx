// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const visitor = vi.hoisted(() => ({
  person: { name: "Priya Raman" } as { name: string | null } | null,
  email: { kind: "none" } as { kind: string; email?: string },
}));

vi.mock("@/features/site", () => ({ getTranslate: async () => (key: string) => key }));
vi.mock("@/features/auth", () => ({ addEmail: vi.fn(), resendEmailLink: vi.fn() }));
vi.mock("@/features/account", async () => {
  const { parseTab } = await import("@/features/account/tabs");
  return {
    parseTab,
    getDashboardPerson: async () => visitor.person,
    getEmailState: async () => visitor.email,
    DashboardScreen: (props: {
      name: string | null;
      active: string;
      postHref: string;
      emailPending: boolean;
      notice: React.ReactNode;
      children: React.ReactNode;
    }) => (
      <div
        data-testid="screen"
        data-name={props.name ?? ""}
        data-active={props.active}
        data-post={props.postHref}
        data-pending={String(props.emailPending)}
      >
        {props.notice}
        {props.children}
      </div>
    ),
    EmailPrompt: (props: { state: { kind: string } }) => (
      <p data-testid="prompt">{props.state.kind}</p>
    ),
    TabEmpty: (props: { tab: string; browseHref: string; postHref: string }) => (
      <p data-testid="empty">{`${props.tab} ${props.browseHref} ${props.postHref}`}</p>
    ),
  };
});

const { default: DashboardPage, generateMetadata } = await import("../(account)/dashboard/page");

const open = async (search: Record<string, string | string[] | undefined> = {}) => {
  render(await DashboardPage({ searchParams: Promise.resolve(search) }));
};

beforeEach(() => {
  visitor.person = { name: "Priya Raman" };
  visitor.email = { kind: "none" };
});

describe("the dashboard page (S5-T04)", () => {
  it("is titled", async () => {
    expect((await generateMetadata()).title).toBe("account.dashboard.metaTitle");
  });

  it("shows the Saved tab when the address names none", async () => {
    await open();
    expect(screen.getByTestId("screen")).toHaveAttribute("data-active", "saved");
    expect(screen.getByTestId("empty")).toHaveTextContent("saved /properties /post-property");
  });

  it("shows the tab the address names, with that tab's empty state", async () => {
    await open({ tab: "received" });
    expect(screen.getByTestId("screen")).toHaveAttribute("data-active", "received");
    expect(screen.getByTestId("empty")).toHaveTextContent("received");
  });

  it("falls back to Saved for a tab that does not exist", async () => {
    await open({ tab: "admin" });
    expect(screen.getByTestId("screen")).toHaveAttribute("data-active", "saved");
  });

  it("greets the person by name and links Post a property", async () => {
    await open();
    expect(screen.getByTestId("screen")).toHaveAttribute("data-name", "Priya Raman");
    expect(screen.getByTestId("screen")).toHaveAttribute("data-post", "/post-property");
  });

  it("has no name to greet when the person skipped that step", async () => {
    visitor.person = { name: null };
    await open();
    expect(screen.getByTestId("screen")).toHaveAttribute("data-name", "");
  });

  it("shows the email prompt for someone with no address", async () => {
    await open();
    expect(screen.getByTestId("prompt")).toHaveTextContent("none");
    expect(screen.getByTestId("screen")).toHaveAttribute("data-pending", "false");
  });

  it("shows the reminder, and the badge, for a link that was sent and not used", async () => {
    visitor.email = { kind: "pending", email: "priya@example.com" };
    await open();
    expect(screen.getByTestId("prompt")).toHaveTextContent("pending");
    expect(screen.getByTestId("screen")).toHaveAttribute("data-pending", "true");
  });

  it("asks nothing of someone whose address is confirmed", async () => {
    visitor.email = { kind: "verified", email: "priya@example.com" };
    await open();
    expect(screen.queryByTestId("prompt")).toBeNull();
  });

  it("asks nothing when the email state could not be read", async () => {
    visitor.email = { kind: "unknown" };
    await open();
    expect(screen.queryByTestId("prompt")).toBeNull();
    expect(screen.getByTestId("screen")).toHaveAttribute("data-pending", "false");
  });

  it("renders nothing when nobody is signed in, because the layout's gate is sending them to sign in", async () => {
    visitor.person = null;
    const result = await DashboardPage({ searchParams: Promise.resolve({}) });
    expect(result).toBeNull();
  });
});
