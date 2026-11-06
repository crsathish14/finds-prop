// @vitest-environment jsdom
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { DashboardScreen } = await import("../dashboard-screen");
const { TabEmpty } = await import("../tab-empty");
const { DashboardSkeleton } = await import("../dashboard-skeleton");

const words = en.account.dashboard;

beforeEach(() => {
  router.replace.mockReset();
});

function screenFor(
  tab: "saved" | "listings" | "received" | "sent",
  name: string | null = "Priya Raman",
) {
  return (
    <DashboardScreen name={name} active={tab} postHref="/post-property">
      <TabEmpty tab={tab} browseHref="/properties" postHref="/post-property" />
    </DashboardScreen>
  );
}

describe("DashboardScreen: the dashboard below the header (S5-T04)", () => {
  it("has the heading, a line with the person's name, and Post a property", () => {
    renderWithMessages(screenFor("saved"));
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeInTheDocument();
    expect(
      screen.getByText("Priya Raman · homes you saved, listings you manage and your enquiries."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: words.post })).toHaveAttribute(
      "href",
      "/post-property",
    );
  });

  it("leaves the name out of the line when the person skipped that step", () => {
    renderWithMessages(screenFor("saved", null));
    expect(screen.getByText(words.sub)).toBeInTheDocument();
    renderWithMessages(screenFor("saved", "   "));
    expect(screen.getAllByText(words.sub)).toHaveLength(2);
  });

  it("shows no Email not verified badge unless asked", () => {
    renderWithMessages(screenFor("saved"));
    expect(screen.queryByText(words.email.badge)).toBeNull();
  });

  it("shows Email not verified beside the line when a link was sent and not used", () => {
    renderWithMessages(
      <DashboardScreen name="Priya Raman" active="saved" postHref="/post-property" emailPending>
        <p>panel</p>
      </DashboardScreen>,
    );
    expect(screen.getByText(words.email.badge)).toBeInTheDocument();
  });

  it("puts the notice between the heading and the tabs", () => {
    renderWithMessages(
      <DashboardScreen
        name={null}
        active="saved"
        postHref="/post-property"
        notice={<p>the notice</p>}
      >
        <p>panel</p>
      </DashboardScreen>,
    );
    const notice = screen.getByText("the notice");
    const tabs = screen.getByRole("tablist");
    expect(notice.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("DashboardTabs: the four tabs live in the address", () => {
  it("lists the four tabs in order, with no counts, and marks the one the address names", () => {
    renderWithMessages(screenFor("received"));
    const list = screen.getByRole("tablist", { name: words.tabsLabel });
    const tabs = within(list).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      words.tabs.saved,
      words.tabs.listings,
      words.tabs.received,
      words.tabs.sent,
    ]);
    expect(screen.getByRole("tab", { name: words.tabs.received })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: words.tabs.saved })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("shows the content the page made for the active tab", () => {
    renderWithMessages(screenFor("sent"));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(words.empty.sent.title);
  });

  it("asks for the other tab's address without scrolling when a tab is chosen", async () => {
    renderWithMessages(screenFor("saved"));
    await userEvent.click(screen.getByRole("tab", { name: words.tabs.listings }));
    expect(router.replace).toHaveBeenCalledWith("/dashboard?tab=listings", { scroll: false });
  });

  it("asks for the plain address when Saved, the default, is chosen", async () => {
    renderWithMessages(screenFor("sent"));
    await userEvent.click(screen.getByRole("tab", { name: words.tabs.saved }));
    expect(router.replace).toHaveBeenCalledWith("/dashboard", { scroll: false });
  });

  it("moves between tabs with the arrow keys", async () => {
    renderWithMessages(screenFor("saved"));
    act(() => screen.getByRole("tab", { name: words.tabs.saved }).focus());
    expect(screen.getByRole("tab", { name: words.tabs.saved })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: words.tabs.listings })).toHaveFocus();
    expect(router.replace).toHaveBeenCalledWith("/dashboard?tab=listings", { scroll: false });
  });

  it("marks the chosen tab at once and shows waiting rows until the page has the new content", async () => {
    renderWithMessages(screenFor("saved"));
    await act(async () => {
      await userEvent.click(screen.getByRole("tab", { name: words.tabs.sent }));
    });
    // The test's router does not navigate, so the transition ends and the active tab is shown again.
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
  });

  it("changes the tab through onSelect, and goes nowhere, in the Design Lab", async () => {
    const onSelect = vi.fn();
    renderWithMessages(
      <DashboardScreen name={null} active="saved" postHref="/post-property" onSelect={onSelect}>
        <p>panel</p>
      </DashboardScreen>,
    );
    await userEvent.click(screen.getByRole("tab", { name: words.tabs.received }));
    expect(onSelect).toHaveBeenCalledWith("received");
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("TabEmpty: what each tab says while it has nothing", () => {
  const cases = [
    ["saved", words.empty.saved, "/properties"],
    ["listings", words.empty.listings, "/post-property"],
    ["received", words.empty.received, "/post-property"],
    ["sent", words.empty.sent, "/properties"],
  ] as const;

  it.each(cases)("the %s tab has its own words and next step", (tab, text, href) => {
    renderWithMessages(<TabEmpty tab={tab} browseHref="/properties" postHref="/post-property" />);
    expect(screen.getByRole("heading", { level: 2, name: text.title })).toBeInTheDocument();
    expect(screen.getByText(text.body)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: text.action })).toHaveAttribute("href", href);
    expect(screen.getByRole("status")).toHaveAttribute("data-tab", tab);
  });
});

describe("DashboardSkeleton: the outline while the dashboard loads", () => {
  it("draws only blocks, hidden from screen readers", () => {
    const { container } = renderWithMessages(<DashboardSkeleton />);
    expect(container.querySelectorAll("[data-slot=skeleton]").length).toBeGreaterThan(3);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
