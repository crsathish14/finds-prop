import { describe, expect, it } from "vitest";
import { compactDates, endsBeforeStart, isRunning, promotionStatus } from "../promotion-dates";

describe("UT-promotion-dates: where a promotion stands today (ADR-210)", () => {
  const today = "2026-11-26";

  it("runs with no dates, and from its start date to its end date, both days included", () => {
    expect(promotionStatus(undefined, today)).toBe("running");
    expect(promotionStatus({}, today)).toBe("running");
    expect(promotionStatus({ startsOn: today, endsOn: today }, today)).toBe("running");
    expect(promotionStatus({ startsOn: "2026-11-01" }, today)).toBe("running");
    expect(promotionStatus({ endsOn: "2026-12-31" }, today)).toBe("running");
  });

  it("is scheduled before its start date and ended after its end date", () => {
    expect(promotionStatus({ startsOn: "2026-11-27" }, today)).toBe("scheduled");
    expect(promotionStatus({ endsOn: "2026-11-25" }, today)).toBe("ended");
    expect(isRunning({ startsOn: "2026-12-01", endsOn: "2026-12-31" }, today)).toBe(false);
  });

  it("finds an end date before the start date, and keeps only the days given", () => {
    expect(endsBeforeStart({ startsOn: "2026-12-02", endsOn: "2026-12-01" })).toBe(true);
    expect(endsBeforeStart({ startsOn: "2026-12-01", endsOn: "2026-12-01" })).toBe(false);
    expect(endsBeforeStart({ endsOn: "2026-12-01" })).toBe(false);
    expect(compactDates({ startsOn: undefined, endsOn: "2026-12-01" })).toEqual({
      endsOn: "2026-12-01",
    });
  });
});
