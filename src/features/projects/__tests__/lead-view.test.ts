import { describe, expect, it } from "vitest";
import {
  addDays,
  indiaToday,
  VISIT_DAYS_AHEAD,
  visitDateProblem,
  visitDateWindow,
} from "../lead-view";

/** 11 pm on 5 Nov in UTC is already 4:30 am on 6 Nov in India. */
const LATE_UTC = new Date("2026-11-05T23:00:00Z");
const NOON_UTC = new Date("2026-11-05T12:00:00Z");

describe("UT-lead-view: the days a site visit can be asked for", () => {
  it("counts today in India time, not UTC", () => {
    expect(indiaToday(LATE_UTC)).toBe("2026-11-06");
    expect(indiaToday(NOON_UTC)).toBe("2026-11-05");
  });

  it("moves a date by days across a month and a year", () => {
    expect(addDays("2026-11-28", 5)).toBe("2026-12-03");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("is today to a year ahead", () => {
    expect(VISIT_DAYS_AHEAD).toBe(365);
    expect(visitDateWindow(NOON_UTC)).toEqual({ min: "2026-11-05", max: "2027-11-05" });
  });

  it("accepts today, a day in the middle and the last day", () => {
    for (const day of ["2026-11-05", "2026-12-25", "2027-11-05"]) {
      expect(visitDateProblem(day, NOON_UTC), day).toBeNull();
    }
  });

  it("says a date is missing when there is none", () => {
    expect(visitDateProblem(undefined, NOON_UTC)).toBe("missing");
    expect(visitDateProblem("", NOON_UTC)).toBe("missing");
  });

  it("refuses yesterday and the day after the last day", () => {
    expect(visitDateProblem("2026-11-04", NOON_UTC)).toBe("range");
    expect(visitDateProblem("2027-11-06", NOON_UTC)).toBe("range");
  });

  it("uses India's today: just after midnight there, yesterday in UTC is already past", () => {
    expect(visitDateProblem("2026-11-05", LATE_UTC)).toBe("range");
    expect(visitDateProblem("2026-11-06", LATE_UTC)).toBeNull();
  });

  it("refuses what is not a real calendar day", () => {
    for (const text of ["2026-02-30", "2026-13-01", "tomorrow", "2026-1-5", "05-11-2026"]) {
      expect(visitDateProblem(text, NOON_UTC), text).toBe("range");
    }
  });
});
