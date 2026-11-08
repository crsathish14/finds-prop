import { describe, expect, it } from "vitest";
import { tabCountsFrom } from "../tab-counts";

const say = (count: number) => `${count} new`;

describe("tabCountsFrom: the numbers on the dashboard tabs (S6-T03)", () => {
  it("gives every tab its number", () => {
    expect(
      tabCountsFrom({ saved: 3, listings: 5, received: { total: 4, fresh: 1 }, sent: 2 }, say),
    ).toEqual({
      saved: { value: 3 },
      listings: { value: 5 },
      received: { value: "1 new", tone: "new" },
      sent: { value: 2 },
    });
  });

  it("leaves out a tab with nothing to count", () => {
    expect(
      tabCountsFrom({ saved: 0, listings: 0, received: { total: 0, fresh: 0 }, sent: 0 }, say),
    ).toEqual({});
  });

  it("shows the total in the plain style when no enquiry is New", () => {
    expect(
      tabCountsFrom({ saved: 0, listings: 0, received: { total: 6, fresh: 0 }, sent: 0 }, say),
    ).toEqual({ received: { value: 6 } });
  });
});
