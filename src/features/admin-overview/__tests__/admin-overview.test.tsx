// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type * as ReactModule from "react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import en from "@/i18n/messages/en.json";
import type { ResolvedOverviewRange } from "../range";
import type { Overview } from "../view";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

// A transition is over as soon as its function has run in a test; this lets a test hold one open to see the
// "Updating" line, which a real navigation shows until the server has sent the new numbers.
const transition = vi.hoisted(() => ({ pending: false }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    useTransition: () => [transition.pending, (work: () => void) => work()] as const,
  };
});

const { AdminOverview } = await import("../admin-overview.client");

const words = en.admin.overview;

const OVERVIEW: Overview = {
  listings: { total: 248, approved: 196, pending: 14 },
  people: { customers: 1284, agents: 7, builders: 12 },
  leads: { total: 862, enquiries: 417, shortlists: 1930, visitors: 13_469, today: 23 },
  conversion: 6.4,
  sources: { projectPages: 412, propertyEnquiries: 268, otherForms: 126 },
  daily: [
    { day: "2026-10-01", leads: 24, enquiries: 13, shortlists: 52 },
    { day: "2026-10-02", leads: 26, enquiries: 14, shortlists: 55 },
    { day: "2026-10-03", leads: 28, enquiries: 15, shortlists: 53 },
  ],
  topProjects: [
    { id: "p1", name: "Kadal Vista", enquiries: 128 },
    { id: "p2", name: "Arivu Heights", enquiries: 96 },
  ],
  recent: [
    {
      id: "l1",
      source: "project",
      kind: "enquiry",
      name: "Arjun Menon",
      label: "Kadal Vista",
      ago: { unit: "minutes", count: 12 },
    },
    {
      id: "l2",
      source: "project",
      kind: "site_visit",
      name: "Divya Krishnan",
      label: "Arivu Heights",
      ago: { unit: "hours", count: 1 },
    },
    {
      id: "l3",
      source: "form",
      kind: null,
      name: null,
      label: "Contact page",
      ago: { unit: "yesterday" },
    },
  ],
  active: true,
};

const RANGE: ResolvedOverviewRange = { range: "30", from: "2026-10-01", to: "2026-10-03" };

type Props = Parameters<typeof AdminOverview>[0];
const props = (extra: Partial<Props> = {}): Props => ({
  path: "/admin/dashboard",
  state: { ok: true, overview: OVERVIEW, range: RANGE },
  filters: RANGE,
  ...extra,
});

const withProviders = (ui: ReactElement) => (
  <NextIntlClientProvider locale="en" messages={en}>
    <TooltipProvider>{ui}</TooltipProvider>
  </NextIntlClientProvider>
);

/** Mounts the page; `again` shows it again with other props, as the server does after a read. */
function open(extra: Partial<Props> = {}) {
  const view = render(withProviders(<AdminOverview {...props(extra)} />));
  return {
    again: (next: Partial<Props>) =>
      view.rerender(withProviders(<AdminOverview {...props(next)} />)),
  };
}

/** The tile with a name, inside its group. */
const tileIn = (group: string, name: string) =>
  within(screen.getByRole("region", { name: group }))
    .getByText(name)
    .closest("[data-slot=stat-tile]");

const first = <T,>(list: T[]): T => list[0] as T;

beforeEach(() => {
  vi.clearAllMocks();
  transition.pending = false;
});

describe("AdminOverview: the numbers (S7-T06 part 3)", () => {
  it("shows the heading and three groups of numbers formatted the Indian way", () => {
    open();
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeVisible();
    expect(screen.getByText(words.intro)).toBeVisible();
    expect(tileIn(words.groups.listings, words.tiles.total)).toHaveTextContent("248");
    expect(tileIn(words.groups.listings, words.tiles.active)).toHaveTextContent("196");
    expect(tileIn(words.groups.listings, words.tiles.waiting)).toHaveTextContent("14");
    expect(tileIn(words.groups.listings, words.tiles.waiting)).toHaveTextContent(
      words.notes.review,
    );
    expect(tileIn(words.groups.people, words.tiles.customers)).toHaveTextContent("1,284");
    expect(tileIn(words.groups.people, words.tiles.agents)).toHaveTextContent(words.notes.agents);
    expect(tileIn(words.groups.engagement, words.tiles.leads)).toHaveTextContent("862");
    expect(tileIn(words.groups.engagement, words.tiles.today)).toHaveTextContent("23");
    expect(tileIn(words.groups.engagement, words.tiles.enquiries)).toHaveTextContent("417");
    expect(tileIn(words.groups.engagement, words.tiles.shortlisted)).toHaveTextContent("1,930");
  });

  it("shows the conversion as a percentage with the note that its definition is to be confirmed", () => {
    open();
    const tile = tileIn(words.groups.engagement, words.tiles.conversion);
    expect(tile).toHaveTextContent("6.4%");
    expect(tile).toHaveTextContent(words.notes.conversion);
  });

  it("shows a dash for the conversion when nobody visited", () => {
    open({ state: { ok: true, overview: { ...OVERVIEW, conversion: null }, range: RANGE } });
    expect(tileIn(words.groups.engagement, words.tiles.conversion)).toHaveTextContent("—");
  });
});

describe("AdminOverview: the date choice (S7-T06 part 3)", () => {
  it("offers Today, Yesterday, 7 days, 30 days, This month and Custom, with the chosen one on", () => {
    open();
    const group = screen.getByRole("radiogroup", { name: words.range.label });
    expect(
      within(group)
        .getAllByRole("radio")
        .map((radio) => radio.textContent),
    ).toEqual(["Today", "Yesterday", "7 days", "30 days", "This month", "Custom"]);
    expect(screen.getByRole("radio", { name: words.range.days30 })).toBeChecked();
  });

  it("goes to the address for another choice, keeping the page", () => {
    open();
    fireEvent.click(screen.getByRole("radio", { name: words.range.today }));
    expect(router.push).toHaveBeenCalledWith("/admin/dashboard?range=today");
    fireEvent.click(screen.getByRole("radio", { name: words.range.yesterday }));
    expect(router.push).toHaveBeenLastCalledWith("/admin/dashboard?range=yesterday");
    fireEvent.click(screen.getByRole("radio", { name: words.range.thisMonth }));
    expect(router.push).toHaveBeenLastCalledWith("/admin/dashboard?range=month");
  });

  it("goes to a custom range with the days already shown", () => {
    open();
    fireEvent.click(screen.getByRole("radio", { name: words.range.custom }));
    expect(router.push).toHaveBeenCalledWith(
      "/admin/dashboard?range=custom&from=2026-10-01&to=2026-10-03",
    );
  });

  it("goes back to the plain address when the default range is chosen again", () => {
    open({ filters: { range: "7", from: "2026-10-27", to: "2026-11-02" } });
    fireEvent.click(screen.getByRole("radio", { name: words.range.days30 }));
    expect(router.push).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("shows the two date boxes for a custom range and reads the page again for a typed day", () => {
    open({ filters: { range: "custom", from: "2026-10-01", to: "2026-10-28" } });
    fireEvent.change(screen.getByLabelText(words.range.from), { target: { value: "2026-10-05" } });
    expect(router.push).toHaveBeenCalledWith(
      "/admin/dashboard?range=custom&from=2026-10-05&to=2026-10-28",
    );
    fireEvent.change(screen.getByLabelText(words.range.to), { target: { value: "2026-10-30" } });
    expect(router.push).toHaveBeenLastCalledWith(
      "/admin/dashboard?range=custom&from=2026-10-01&to=2026-10-30",
    );
  });

  it("leaves an emptied date box alone until a day is typed", () => {
    open({ filters: { range: "custom", from: "2026-10-01", to: "2026-10-28" } });
    fireEvent.change(screen.getByLabelText(words.range.from), { target: { value: "" } });
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("AdminOverview: the charts (S7-T06 part 3)", () => {
  it("draws the leads, enquiries and shortlists per day, named with the days", () => {
    open();
    expect(screen.getByRole("heading", { name: words.charts.daily.title })).toBeVisible();
    expect(screen.getByText("Per day, 1 Oct to 3 Oct")).toBeVisible();
    expect(screen.getByRole("img", { name: words.charts.daily.label })).toBeVisible();
  });

  it("says one day for a range of one day", () => {
    const one = { range: "today", from: "2026-10-01", to: "2026-10-01" } as const;
    open({
      state: {
        ok: true,
        overview: { ...OVERVIEW, daily: [first(OVERVIEW.daily)] },
        range: one,
      },
      filters: one,
    });
    expect(screen.getByText("Per day, 1 Oct")).toBeVisible();
  });

  it("names the year when the range crosses one", () => {
    open({
      state: {
        ok: true,
        overview: OVERVIEW,
        range: { range: "custom", from: "2025-12-30", to: "2026-01-02" },
      },
    });
    expect(screen.getByText("Per day, 30 Dec 2025 to 2 Jan 2026")).toBeVisible();
  });

  it("switches the line chart to its table, which says the same numbers", () => {
    open();
    fireEvent.click(screen.getByRole("radio", { name: words.charts.views.table }));
    const grid = screen.getByRole("table", { name: words.charts.daily.label });
    expect(
      within(grid)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual([
      words.charts.daily.dateColumn,
      words.charts.daily.shortlists,
      words.charts.daily.leads,
      words.charts.daily.enquiries,
    ]);
    const row = within(grid).getByRole("rowheader", { name: "2 Oct 2026" }).closest("tr");
    expect(
      within(row as HTMLElement)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["55", "26", "14"]);
  });

  it("keeps the Chart / Table choice while the numbers are read again", () => {
    const view = open();
    fireEvent.click(screen.getByRole("radio", { name: words.charts.views.table }));
    transition.pending = true;
    view.again({});
    expect(screen.getByRole("table", { name: words.charts.daily.label })).toBeVisible();
    expect(screen.getByRole("radio", { name: words.charts.views.table })).toBeChecked();
  });

  it("shows where the leads came from, adding up to the leads", () => {
    open();
    expect(screen.getByText("Share of 806 leads")).toBeVisible();
    const table = screen.getByRole("table", { name: words.charts.sources.label });
    expect(
      within(table).getByRole("rowheader", { name: words.charts.sources.projectPages }),
    ).toBeVisible();
    expect(within(table).getByText("412")).toBeVisible();
    expect(within(table).getByText("51%")).toBeVisible();
  });

  it("lists the projects with the most enquiries, with how many are shown", () => {
    open();
    expect(screen.getByText("Top 2 projects")).toBeVisible();
    const list = screen.getByRole("list", { name: words.charts.projects.label });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(list).toHaveTextContent("Kadal Vista");
    expect(list).toHaveTextContent("128");
  });

  it("says 'Top 1 project' for one", () => {
    open({
      state: {
        ok: true,
        overview: { ...OVERVIEW, topProjects: [{ id: "p1", name: "Kadal Vista", enquiries: 3 }] },
        range: RANGE,
      },
    });
    expect(screen.getByText("Top 1 project")).toBeVisible();
  });

  it("lists the newest leads with what they asked about and how long ago, and links to all of them", () => {
    open();
    const list = screen.getByRole("list", { name: words.charts.recent.label });
    const [one, two, three] = within(list).getAllByRole("listitem");
    expect(one).toHaveTextContent("Arjun Menon");
    expect(one).toHaveTextContent("Kadal Vista · Enquiry");
    expect(one).toHaveTextContent("12 min ago");
    expect(two).toHaveTextContent("Arivu Heights · Site visit");
    expect(two).toHaveTextContent("1 hr ago");
    expect(three).toHaveTextContent(words.charts.recent.someone);
    expect(three).toHaveTextContent("Contact page · Message");
    expect(three).toHaveTextContent("Yesterday");
    expect(screen.getByRole("link", { name: words.charts.recent.all })).toHaveAttribute(
      "href",
      "/admin/leads",
    );
  });

  it("says days, a date and just now for the other ages", () => {
    const lead = first(OVERVIEW.recent);
    open({
      state: {
        ok: true,
        overview: {
          ...OVERVIEW,
          recent: [
            { ...lead, id: "a", ago: { unit: "days", count: 3 } },
            { ...lead, id: "b", ago: { unit: "date", day: "2026-09-12" } },
            { ...lead, id: "c", ago: { unit: "now" } },
          ],
        },
        range: RANGE,
      },
    });
    const items = within(
      screen.getByRole("list", { name: words.charts.recent.label }),
    ).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("3 days ago");
    expect(items[1]).toHaveTextContent("12 Sept 2026");
    expect(items[2]).toHaveTextContent("just now");
  });
});

describe("AdminOverview: nothing yet (S7-T06 part 3)", () => {
  const QUIET: Overview = {
    ...OVERVIEW,
    leads: { ...OVERVIEW.leads, total: 0, enquiries: 0, shortlists: 0, today: 0 },
    conversion: 0,
    sources: { projectPages: 0, propertyEnquiries: 0, otherForms: 0 },
    daily: OVERVIEW.daily.map((entry) => ({ ...entry, leads: 0, enquiries: 0, shortlists: 0 })),
    topProjects: [],
    recent: [],
    active: false,
  };

  it("says there was no activity in the range, instead of a flat chart", () => {
    open({ state: { ok: true, overview: QUIET, range: RANGE } });
    expect(screen.getByText(words.charts.daily.empty.title)).toBeVisible();
    expect(screen.queryByRole("img", { name: words.charts.daily.label })).toBeNull();
    expect(screen.queryByRole("radio", { name: words.charts.views.table })).toBeNull();
  });

  it("says so in each card that has nothing to show, and keeps the numbers (zeros)", () => {
    open({ state: { ok: true, overview: QUIET, range: RANGE } });
    expect(screen.getByText(words.charts.sources.empty.title)).toBeVisible();
    expect(screen.getByText(words.charts.projects.empty.title)).toBeVisible();
    expect(screen.getByText(words.charts.recent.empty.title)).toBeVisible();
    expect(screen.queryByText("Top 0 projects")).toBeNull();
    expect(tileIn(words.groups.engagement, words.tiles.leads)).toHaveTextContent("0");
  });
});

describe("AdminOverview: reloading (S7-T06 part 3)", () => {
  it("shows no 'Updating' line when nothing is loading", () => {
    open();
    expect(screen.queryByText(words.updating)).toBeNull();
  });

  it("keeps the numbers on screen and says it is updating while the new ones are read", () => {
    transition.pending = true;
    open();
    expect(screen.getByRole("status")).toHaveTextContent(words.updating);
    expect(tileIn(words.groups.listings, words.tiles.total)).toHaveTextContent("248");
    expect(screen.getByRole("heading", { name: words.charts.daily.title })).toBeVisible();
  });
});

describe("AdminOverview: a read that failed (S7-T06 part 3)", () => {
  it("says so with a way to try again, and nothing else when no numbers ever arrived", () => {
    open({ state: { ok: false } });
    const notice = screen.getByRole("alert");
    expect(notice).toHaveTextContent(words.error.title);
    expect(notice).toHaveTextContent(words.error.text);
    expect(notice).not.toHaveTextContent("last successful load");
    expect(screen.queryByRole("region", { name: words.groups.listings })).toBeNull();
    expect(screen.queryByRole("heading", { name: words.charts.daily.title })).toBeNull();
    // The date choice stays, so another one can still be tried.
    expect(screen.getByRole("radio", { name: words.range.days7 })).toBeVisible();
  });

  it("asks the server to read the page again when 'Try again' is pressed", () => {
    open({ state: { ok: false } });
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Try again" }));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the last numbers that arrived under the notice, and says they are old", () => {
    const view = open();
    expect(screen.queryByRole("alert")).toBeNull();
    view.again({
      state: { ok: false },
      filters: { range: "7", from: "2026-10-27", to: "2026-11-02" },
    });
    const notice = screen.getByRole("alert");
    expect(notice).toHaveTextContent(words.error.title);
    expect(notice).toHaveTextContent("The numbers below are from the last successful load.");
    expect(tileIn(words.groups.listings, words.tiles.total)).toHaveTextContent("248");
    expect(screen.getByText("Per day, 1 Oct to 3 Oct")).toBeVisible();
    // The choice in the address is the one that failed, so it is the one that shows as chosen.
    expect(screen.getByRole("radio", { name: words.range.days7 })).toBeChecked();
  });

  it("shows new numbers again, without the notice, once a read works", () => {
    const view = open();
    view.again({ state: { ok: false } });
    view.again({
      state: {
        ok: true,
        overview: { ...OVERVIEW, listings: { total: 300, approved: 250, pending: 5 } },
        range: RANGE,
      },
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(tileIn(words.groups.listings, words.tiles.total)).toHaveTextContent("300");
  });
});
