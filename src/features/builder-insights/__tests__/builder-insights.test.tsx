// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { InsightsNumbers } from "../view";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { BuilderInsights } = await import("../builder-insights.client");

const words = en.builderPortal.insights;

const NUMBERS: InsightsNumbers = {
  projects: 4,
  activeProjects: 3,
  totalUnits: 520,
  availableUnits: 301,
  soldUnits: 164,
  views: 6420,
  visitors: 3918,
  shortlists: 342,
  comparisons: 97,
  brochures: 211,
  calls: 74,
  whatsapp: 63,
  enquiries: 128,
  leads: 186,
  siteVisits: 29,
};

type Range = "7" | "30" | "month" | "custom";
const FILTERS: { range: Range; from: string; to: string; project: string } = {
  range: "30",
  from: "2026-10-11",
  to: "2026-11-09",
  project: "",
};
const PROJECTS = [
  { id: "p1", name: "Kadal Vista" },
  { id: "p2", name: "Kadal Courts" },
];

function open(
  props: Partial<Parameters<typeof BuilderInsights>[0]> & {
    variant?: "dashboard" | "insights";
  } = {},
) {
  const variant = props.variant ?? "dashboard";
  renderWithMessages(
    <BuilderInsights
      variant={variant}
      path={`/builder/${variant}`}
      numbers={NUMBERS}
      filters={FILTERS}
      projects={PROJECTS}
      pending={{ count: 0, name: null }}
      {...props}
    />,
  );
}

/** The tile with a name, inside its group. */
const tileIn = (group: string, name: string) =>
  within(screen.getByRole("region", { name: group }))
    .getByText(name)
    .closest("[data-slot=stat-tile]");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BuilderInsights: the builder's Dashboard (S7-T03 step E)", () => {
  it("shows the heading, three groups of numbers formatted the Indian way, and no project box", () => {
    open();
    expect(screen.getByRole("heading", { level: 1, name: words.dashboard.title })).toBeVisible();
    expect(screen.getByText(words.dashboard.intro)).toBeVisible();
    for (const group of [words.groups.portfolio, words.groups.activity, words.groups.actions]) {
      expect(screen.getByRole("region", { name: group })).toBeVisible();
    }
    expect(tileIn(words.groups.activity, words.tiles.views)).toHaveTextContent("6,420");
    expect(tileIn(words.groups.portfolio, words.tiles.availableUnits)).toHaveTextContent("301");
    expect(tileIn(words.groups.portfolio, words.tiles.availableUnits)).toHaveTextContent(
      "164 sold",
    );
    expect(tileIn(words.groups.portfolio, words.tiles.activeProjects)).toHaveTextContent(
      words.notes.activeProjects,
    );
    expect(tileIn(words.groups.actions, words.tiles.siteVisits)).toHaveTextContent("29");
    expect(screen.queryByLabelText(words.project.label)).toBeNull();
  });

  it("calls the group 'Activity this month' only when This month is chosen", () => {
    open({ filters: { ...FILTERS, range: "month", from: "2026-11-01" } });
    expect(screen.getByRole("region", { name: words.groups.activityMonth })).toBeVisible();
    expect(screen.queryByRole("region", { name: words.groups.activity })).toBeNull();
  });

  it("shows no notice when nothing waits for approval", () => {
    open();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("names the project when exactly one waits for approval", () => {
    open({ pending: { count: 1, name: "Nila Grove" } });
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("1 project is waiting for approval");
    expect(notice).toHaveTextContent(
      "Nila Grove was edited and is hidden from the public site until it is approved.",
    );
  });

  it("says how many wait, and not which, when several do", () => {
    open({ pending: { count: 3, name: null } });
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("3 projects are waiting for approval");
    expect(notice).toHaveTextContent(words.pending.many);
  });

  it("goes to the address for another date choice, keeping the page", () => {
    open();
    fireEvent.click(screen.getByRole("radio", { name: words.range.days7 }));
    expect(router.push).toHaveBeenCalledWith("/builder/dashboard?range=7");
    fireEvent.click(screen.getByRole("radio", { name: words.range.thisMonth }));
    expect(router.push).toHaveBeenLastCalledWith("/builder/dashboard?range=month");
  });

  it("goes to a custom range with the days already shown", () => {
    open();
    fireEvent.click(screen.getByRole("radio", { name: words.range.custom }));
    expect(router.push).toHaveBeenCalledWith(
      "/builder/dashboard?range=custom&from=2026-10-11&to=2026-11-09",
    );
  });

  it("goes back to the plain address when the default range is chosen again", () => {
    open({ filters: { ...FILTERS, range: "7", from: "2026-11-03" } });
    fireEvent.click(screen.getByRole("radio", { name: words.range.days30 }));
    expect(router.push).toHaveBeenCalledWith("/builder/dashboard");
  });
});

describe("BuilderInsights: the Insights page (S7-T03 step E)", () => {
  it("shows the Activity and Actions groups, without the portfolio, and the project box", () => {
    open({ variant: "insights" });
    expect(screen.getByRole("heading", { level: 1, name: words.insights.title })).toBeVisible();
    expect(screen.getByRole("region", { name: words.groups.activity })).toBeVisible();
    expect(screen.getByRole("region", { name: words.groups.actions })).toBeVisible();
    expect(screen.queryByRole("region", { name: words.groups.portfolio })).toBeNull();
    const box = screen.getByLabelText(words.project.label);
    expect(box).toHaveValue("");
    expect(within(box).getByRole("option", { name: words.project.all })).toBeVisible();
  });

  it("goes to the address for a project, keeping the dates, and back to all of them", () => {
    open({ variant: "insights", filters: { ...FILTERS, range: "7", from: "2026-11-03" } });
    fireEvent.change(screen.getByLabelText(words.project.label), { target: { value: "p2" } });
    expect(router.push).toHaveBeenCalledWith("/builder/insights?range=7&project=p2");
    fireEvent.change(screen.getByLabelText(words.project.label), { target: { value: "" } });
    expect(router.push).toHaveBeenLastCalledWith("/builder/insights?range=7");
  });

  it("shows the two date boxes for a custom range and reads the page again for a typed day", () => {
    open({
      variant: "insights",
      filters: { range: "custom", from: "2026-10-01", to: "2026-10-28", project: "" },
    });
    const from = screen.getByLabelText(words.range.from);
    expect(from).toHaveValue("2026-10-01");
    fireEvent.change(from, { target: { value: "2026-10-05" } });
    expect(router.push).toHaveBeenCalledWith(
      "/builder/insights?range=custom&from=2026-10-05&to=2026-10-28",
    );
    fireEvent.change(screen.getByLabelText(words.range.to), { target: { value: "" } });
    expect(router.push).toHaveBeenCalledTimes(1);
  });
});
