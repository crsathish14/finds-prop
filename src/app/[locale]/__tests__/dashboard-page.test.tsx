// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const visitor = vi.hoisted(() => ({
  person: { name: "Priya Raman" } as { name: string | null } | null,
  email: { kind: "none" } as { kind: string; email?: string },
  signedIn: true,
  received: { total: 4, fresh: 1 },
}));

vi.mock("@/features/site", () => ({
  getTranslate: async () => (key: string, values?: Record<string, string | number>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));
vi.mock("@/features/auth", () => ({ addEmail: vi.fn(), resendEmailLink: vi.fn() }));
vi.mock("@/features/enquiries", () => ({
  MyEnquiriesTab: (props: { fallback: React.ReactNode }) => (
    <div data-testid="my-enquiries-tab">{props.fallback}</div>
  ),
  ReceivedEnquiriesTab: (props: { fallback: React.ReactNode }) => (
    <div data-testid="received-tab">{props.fallback}</div>
  ),
  countReceivedEnquiries: async () => visitor.received,
  countSentEnquiries: async (userId: string) => (userId === "user-1" ? 2 : -1),
}));
vi.mock("@/features/listings", () => ({
  MyListingsTab: (props: { fallback: React.ReactNode }) => (
    <div data-testid="my-listings-tab">{props.fallback}</div>
  ),
  countMyListings: async () => 5,
}));
vi.mock("@/server/auth/get-session-view", () => ({
  getSessionView: async () => (visitor.signedIn ? { userId: "user-1" } : null),
}));
vi.mock("@/features/saved", () => ({
  SavedTab: (props: { fallback: React.ReactNode }) => (
    <div data-testid="saved-tab">{props.fallback}</div>
  ),
  countSavedHomes: async () => 3,
}));
vi.mock("@/features/account", async () => {
  const { parseTab } = await import("@/features/account/tabs");
  return {
    parseTab,
    getDashboardPerson: async () => visitor.person,
    getEmailState: async () => visitor.email,
    tabCountsFrom: (
      raw: {
        saved: number;
        listings: number;
        received: { total: number; fresh: number };
        sent: number;
      },
      newWord: (count: number) => string,
    ) => ({ raw, news: newWord(raw.received.fresh) }),
    DashboardScreen: (props: {
      name: string | null;
      active: string;
      postHref: string;
      emailPending: boolean;
      counts: unknown;
      notice: React.ReactNode;
      children: React.ReactNode;
    }) => (
      <div
        data-testid="screen"
        data-name={props.name ?? ""}
        data-active={props.active}
        data-post={props.postHref}
        data-pending={String(props.emailPending)}
        data-counts={JSON.stringify(props.counts)}
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
  visitor.signedIn = true;
  visitor.received = { total: 4, fresh: 1 };
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

describe("the Saved tab (S5-T01)", () => {
  it("draws the saved homes in place of the empty state, through the saved-tab component", async () => {
    await open({ tab: "saved" });
    expect(screen.getByTestId("saved-tab")).toBeInTheDocument();
  });

  it("does not draw the saved homes on the other tabs", async () => {
    await open({ tab: "sent" });
    expect(screen.queryByTestId("saved-tab")).toBeNull();
  });
});

describe("the My enquiries tab (S5-T03)", () => {
  it("draws the sent enquiries in place of the empty state, through the my-enquiries component", async () => {
    await open({ tab: "sent" });
    expect(screen.getByTestId("my-enquiries-tab")).toBeInTheDocument();
  });

  it("does not draw them on the other tabs", async () => {
    await open({ tab: "listings" });
    expect(screen.queryByTestId("my-enquiries-tab")).toBeNull();
  });
});

describe("the My listings and Enquiries received tabs (S6-T03)", () => {
  it("draws the owner's listings through the my-listings component, on that tab only", async () => {
    await open({ tab: "listings" });
    expect(screen.getByTestId("my-listings-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("received-tab")).toBeNull();
    expect(screen.queryByTestId("my-enquiries-tab")).toBeNull();
  });

  it("draws the enquiries received through the received component, on that tab only", async () => {
    await open({ tab: "received" });
    expect(screen.getByTestId("received-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("my-listings-tab")).toBeNull();
  });

  it("gives each tab its empty state as the fallback", async () => {
    await open({ tab: "listings" });
    expect(screen.getByTestId("empty")).toHaveTextContent("listings /properties /post-property");
  });
});

describe("the numbers on the tabs (S6-T03)", () => {
  it("reads the four counts together and words the New ones", async () => {
    await open();
    const counts = JSON.parse(screen.getByTestId("screen").getAttribute("data-counts") ?? "{}");
    expect(counts.raw).toEqual({
      saved: 3,
      listings: 5,
      received: { total: 4, fresh: 1 },
      sent: 2,
    });
    expect(counts.news).toBe('account.dashboard.counts.new {"count":1}');
  });

  it("reads nothing for a visitor who is not signed in", async () => {
    visitor.signedIn = false;
    visitor.person = null;
    const result = await DashboardPage({ searchParams: Promise.resolve({}) });
    expect(result).toBeNull();
  });
});
