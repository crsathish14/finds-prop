// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import en from "@/i18n/messages/en.json";
import type { PlacesUsageState } from "../admin-overview.client";
import type { ResolvedOverviewRange } from "../range";
import type { Overview, PlacesUsageNumbers } from "../view";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { AdminOverview } = await import("../admin-overview.client");

const words = en.admin.overview;
const card = en.domain.placesUsage;

const OVERVIEW: Overview = {
  listings: { total: 248, approved: 196, pending: 14 },
  people: { customers: 1284, agents: 7, builders: 12 },
  leads: { total: 862, enquiries: 417, shortlists: 1930, visitors: 13_469, today: 23 },
  conversion: 6.4,
  sources: { projectPages: 412, propertyEnquiries: 268, otherForms: 126 },
  daily: [{ day: "2026-10-01", leads: 24, enquiries: 13, shortlists: 52 }],
  topProjects: [{ id: "p1", name: "Kadal Vista", enquiries: 128 }],
  recent: [],
  active: true,
};

const RANGE: ResolvedOverviewRange = { range: "30", from: "2026-10-01", to: "2026-10-01" };

const USAGE: PlacesUsageNumbers = {
  days: Array.from({ length: 30 }, (_unused, index) => ({
    day: `2026-10-${String(index + 1).padStart(2, "0")}`,
    calls: index + 1,
  })),
  today: 1_212,
  month: 6_948,
  callers: { search_box: 5_420, listing_form: 1_130, admin_picker: 86, ai_chat: 312 },
  outcomes: { ok: 6_402, empty: 214, timeout: 38, quota: 270, error: 24 },
};

type Props = Parameters<typeof AdminOverview>[0];

function open(
  placesUsage?: PlacesUsageState,
  state: Props["state"] = { ok: true, overview: OVERVIEW, range: RANGE },
) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <TooltipProvider>
        <AdminOverview
          path="/admin/dashboard"
          state={state}
          filters={RANGE}
          {...(placesUsage ? { placesUsage } : {})}
        />
      </TooltipProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("AdminOverview: the place search card (PR 6b, ADR-134)", () => {
  it("shows the card under the charts, with the numbers, the callers and how the calls ended", () => {
    open({ ok: true, usage: USAGE });
    const recentHeading = screen.getByRole("heading", { name: words.charts.recent.title });
    const cardHeading = screen.getByRole("heading", { name: card.title });
    // Under the existing charts: the card's heading comes after the last chart's heading in the page.
    expect(
      recentHeading.compareDocumentPosition(cardHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(screen.getByText(card.today).closest("[data-slot=stat-tile]")).toHaveTextContent(
      "1,212",
    );
    expect(screen.getByText(card.month).closest("[data-slot=stat-tile]")).toHaveTextContent(
      "6,948",
    );
    // 38 timed out + 270 refused + 24 failed.
    const problems = screen.getByText(card.problems).closest("[data-slot=stat-tile]");
    expect(problems).toHaveTextContent("332");
    expect(problems).toHaveTextContent(card.problemsSome);

    const callers = screen.getByRole("list", { name: card.callers.title });
    expect(callers).toHaveTextContent("Search box");
    expect(callers).toHaveTextContent("5,420");
    expect(callers).toHaveTextContent("Post form");
    expect(callers).toHaveTextContent("Admin pickers");
    expect(callers).toHaveTextContent("AI chat");
    const outcomes = screen.getByRole("list", { name: card.outcomes.title });
    expect(outcomes).toHaveTextContent(card.outcomes.ok);
    expect(outcomes).toHaveTextContent("6,402");
  });

  it("names the days of the card's table the way the Overview names its own", () => {
    open({ ok: true, usage: USAGE });
    const switches = screen.getAllByRole("radio", { name: words.charts.views.table });
    // The overview's own chart switch comes first, the card's second.
    fireEvent.click(switches[1] as HTMLElement);
    const grid = screen.getByRole("table", { name: card.title });
    expect(within(grid).getByRole("rowheader", { name: "1 Oct 2026" })).toBeVisible();
    expect(within(grid).getByRole("rowheader", { name: "30 Oct 2026" })).toBeVisible();
  });

  it("shows the card's empty state when no call has ever been made", () => {
    open({ ok: true, usage: null });
    expect(screen.getByRole("heading", { name: card.title })).toBeVisible();
    expect(screen.getByText(card.empty.title)).toBeVisible();
    expect(screen.queryByText(card.today)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the dashboard's failed block when the read failed, and leaves the rest as it was", () => {
    open({ ok: false });
    const notice = screen.getByRole("alert");
    expect(notice).toHaveTextContent(words.places.error.title);
    expect(notice).toHaveTextContent(words.error.text);
    expect(screen.queryByRole("heading", { name: card.title })).toBeNull();
    // The overview's own numbers and charts are still there.
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeVisible();
    expect(screen.getByRole("heading", { name: words.charts.daily.title })).toBeVisible();
    fireEvent.click(within(notice).getByRole("button", { name: "Try again" }));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the card when the overview itself failed, and says so for the overview only", () => {
    open({ ok: true, usage: USAGE }, { ok: false });
    expect(screen.getByRole("alert")).toHaveTextContent(words.error.title);
    expect(screen.getByRole("heading", { name: card.title })).toBeVisible();
  });

  it("has no place search section when the page does not pass one", () => {
    open();
    expect(screen.queryByRole("heading", { name: card.title })).toBeNull();
    expect(screen.queryByText(card.empty.title)).toBeNull();
  });
});
