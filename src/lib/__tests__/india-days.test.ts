import { describe, expect, it } from "vitest";
import { addDays, dayNumber, dayOf, indiaToday, MAX_RANGE_DAYS } from "../india-days";

describe("UT-india-days: whole days in India time (S7-T03 step E, S7-T06)", () => {
  it("takes the day in India, not in UTC: 19:00 UTC on 31 Oct is already 1 Nov", () => {
    expect(indiaToday(new Date("2026-10-31T19:00:00Z"))).toBe("2026-11-01");
    expect(indiaToday(new Date("2026-10-31T18:00:00Z"))).toBe("2026-10-31");
  });

  it("knows a real calendar day from one that only looks like it", () => {
    expect(dayNumber("2026-11-11")).not.toBeNull();
    expect(dayNumber("2026-02-31")).toBeNull();
    expect(dayNumber("11 Nov 2026")).toBeNull();
    expect(dayNumber(undefined)).toBeNull();
  });

  it("reads a day back from its number", () => {
    expect(dayOf(dayNumber("2026-11-11") ?? 0)).toBe("2026-11-11");
  });

  it("adds days across month and year ends, and refuses what is not a day", () => {
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(() => addDays("2026-13-01", 1)).toThrow("not a day");
  });

  it("keeps the longest range the database answers", () => {
    expect(MAX_RANGE_DAYS).toBe(365);
  });
});
