// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { SponsorReport } from "../sponsor-report";

const rows = {
  hero: [
    { key: "ad-1", name: "Lake Homes", live: true, views: 1200, clicks: 36 },
    { key: "ad-gone", name: null, live: false, views: 90, clicks: 0 },
  ],
  results: [{ key: "b1", name: "Kadal Homes", live: true, views: 0, clicks: 0 }],
  spotlight: [],
};

describe("SponsorReport (ADR-194)", () => {
  it("shows each placement's sponsors with their views, clicks and click rate", () => {
    renderWithMessages(<SponsorReport period={30} from="2026-10-27" to="2026-11-25" rows={rows} />);
    expect(screen.getByRole("heading", { level: 1, name: "Sponsor report" })).toBeVisible();
    const hero = screen.getByRole("region", { name: "Hero ads" });
    const lake = within(hero).getByRole("row", { name: /Lake Homes/ });
    expect(lake).toHaveTextContent("1,200");
    expect(lake).toHaveTextContent("36");
    expect(lake).toHaveTextContent("3%");
    const gone = within(hero).getByRole("row", { name: /Removed sponsor/ });
    expect(gone).toHaveTextContent("Not shown now");
    expect(gone).toHaveTextContent("0%");
    const results = screen.getByRole("region", { name: "Featured project card" });
    expect(within(results).getByRole("row", { name: /Kadal Homes/ })).toHaveTextContent("–");
    const spotlight = screen.getByRole("region", { name: "Developer spotlight" });
    expect(within(spotlight).getByText("No sponsors in this placement yet.")).toBeVisible();
  });

  it("offers the three periods, marking the one shown, with its days", () => {
    renderWithMessages(<SponsorReport period={7} from="2026-11-19" to="2026-11-25" rows={rows} />);
    const periods = within(screen.getByRole("navigation", { name: "Period" })).getAllByRole("link");
    expect(periods.map((link) => link.textContent)).toEqual([
      "Last 7 days",
      "Last 30 days",
      "Last 90 days",
    ]);
    expect(periods[0]).toHaveAttribute("aria-current", "page");
    expect(periods[1]).toHaveAttribute("href", "/admin/sponsor-report?days=30");
    expect(screen.getByText("19 Nov 2026 to 25 Nov 2026")).toBeInTheDocument();
  });
});
