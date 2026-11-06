import { describe, expect, it } from "vitest";
import { DASHBOARD_TABS } from "../schemas";
import { DASHBOARD_PATH, DEFAULT_TAB, parseTab, tabHref } from "../tabs";

describe("parseTab: reading ?tab= (FR-ACC-01, R-FE-11)", () => {
  it("accepts each of the four tabs", () => {
    for (const tab of DASHBOARD_TABS) expect(parseTab(tab)).toBe(tab);
  });

  it("shows Saved when the address names no tab", () => {
    expect(parseTab(undefined)).toBe("saved");
    expect(DEFAULT_TAB).toBe("saved");
  });

  it("drops a value that is not a tab, whatever it looks like", () => {
    for (const bad of ["", "SAVED", "settings", "saved ", "__proto__", "1", "listings,sent"]) {
      expect(parseTab(bad)).toBe("saved");
    }
  });

  it("reads the first of a repeated parameter and drops the rest", () => {
    expect(parseTab(["sent", "listings"])).toBe("sent");
    expect(parseTab(["nope", "sent"])).toBe("saved");
    expect(parseTab([])).toBe("saved");
  });
});

describe("tabHref: the address of a tab", () => {
  it("leaves the default out and names every other tab", () => {
    expect(tabHref("saved")).toBe(DASHBOARD_PATH);
    expect(tabHref("listings")).toBe("/dashboard?tab=listings");
    expect(tabHref("received")).toBe("/dashboard?tab=received");
    expect(tabHref("sent")).toBe("/dashboard?tab=sent");
  });

  it("makes addresses that parseTab reads back as the same tab", () => {
    for (const tab of DASHBOARD_TABS) {
      const query = tabHref(tab).split("?tab=")[1];
      expect(parseTab(query)).toBe(tab);
    }
  });
});
