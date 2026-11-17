// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { PlacesUsageCard, type PlacesUsage } from "../places-usage-card";

const words = en.domain.placesUsage;

const USAGE: PlacesUsage = {
  days: [
    { label: "1 Oct", detailLabel: "1 Oct 2026", calls: 120 },
    { label: "2 Oct", detailLabel: "2 Oct 2026", calls: 180 },
  ],
  today: 180,
  month: 1_234,
  callers: [
    { id: "search_box", label: "Search box", calls: 900 },
    { id: "listing_form", label: "Post form", calls: 334 },
  ],
  outcomes: { ok: 1_200, empty: 30, timeout: 0, quota: 0, error: 0 },
};

describe("PlacesUsageCard (ADR-131)", () => {
  it("shows calls today and this month, formatted", () => {
    renderWithMessages(<PlacesUsageCard usage={USAGE} />);
    expect(screen.getByText(words.today)).toBeInTheDocument();
    expect(screen.getAllByText("180").length).toBeGreaterThan(0);
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("says no problems in words when every call was answered", () => {
    renderWithMessages(<PlacesUsageCard usage={USAGE} />);
    expect(screen.getByText(words.problemsNone)).toBeInTheDocument();
    expect(screen.queryByText(words.problemsSome)).not.toBeInTheDocument();
  });

  it("adds up timeouts, refusals and failures as problems and says so in words", () => {
    renderWithMessages(
      <PlacesUsageCard
        usage={{ ...USAGE, outcomes: { ok: 1_000, empty: 10, timeout: 5, quota: 20, error: 3 } }}
      />,
    );
    const tile = screen.getByText(words.problems).closest("[data-slot='stat-tile']");
    expect(tile).not.toBeNull();
    expect(within(tile as HTMLElement).getByText("28")).toBeInTheDocument();
    expect(screen.getByText(words.problemsSome)).toBeInTheDocument();
  });

  it("names where the calls came from and how they ended", () => {
    renderWithMessages(<PlacesUsageCard usage={USAGE} />);
    expect(screen.getAllByText("Search box").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Post form").length).toBeGreaterThan(0);
    expect(screen.getAllByText(words.outcomes.ok).length).toBeGreaterThan(0);
    expect(screen.getAllByText(words.outcomes.quota).length).toBeGreaterThan(0);
  });

  it("offers the chart and its table", () => {
    renderWithMessages(<PlacesUsageCard usage={USAGE} />);
    expect(
      screen.getByRole("radio", { name: en.admin.overview.charts.views.table }),
    ).toBeInTheDocument();
  });

  it("has an empty state when no call has been made, and no tiles", () => {
    renderWithMessages(<PlacesUsageCard usage={null} />);
    expect(screen.getByText(words.empty.title)).toBeInTheDocument();
    expect(screen.queryByText(words.today)).not.toBeInTheDocument();
  });

  it("shows no cost, allowance or balance anywhere", () => {
    const { container } = renderWithMessages(<PlacesUsageCard usage={USAGE} />);
    expect(container.textContent).not.toMatch(/₹|rupee|allowance|cost|credits?/i);
  });
});
