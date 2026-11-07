// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { DashboardTabsView } from "../dashboard-tabs.client";
import type { TabCounts } from "../schemas";

const LABELS = {
  saved: "Saved",
  listings: "My listings",
  received: "Enquiries received",
  sent: "My enquiries",
};

function tabs(counts?: TabCounts) {
  return renderWithMessages(
    <DashboardTabsView
      active="listings"
      labels={LABELS}
      listLabel="Dashboard sections"
      onSelect={vi.fn()}
      {...(counts ? { counts } : {})}
    >
      <p>the panel</p>
    </DashboardTabsView>,
  );
}

describe("DashboardTabsView: the numbers on the tabs (S6-T03)", () => {
  it("shows a number on the tabs that have one, as part of the tab's name", () => {
    tabs({
      saved: { value: 3 },
      listings: { value: 5 },
      received: { value: "1 new", tone: "new" },
      sent: { value: 2 },
    });
    expect(screen.getByRole("tab", { name: "Saved 3" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "My listings 5" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Enquiries received 1 new" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "My enquiries 2" })).toBeVisible();
  });

  it("leaves out the number of a tab that has none, and every number when none is given", () => {
    tabs({ listings: { value: 5 } });
    expect(screen.getByRole("tab", { name: "Saved" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "My listings 5" })).toBeVisible();
  });

  it("is the same as before when no numbers are given", () => {
    tabs();
    for (const label of Object.values(LABELS)) {
      expect(screen.getByRole("tab", { name: label })).toBeVisible();
    }
  });

  it("shows a zero when the count is zero, because the caller decides what to show", () => {
    tabs({ saved: { value: 0 } });
    expect(screen.getByRole("tab", { name: "Saved 0" })).toBeVisible();
  });
});
