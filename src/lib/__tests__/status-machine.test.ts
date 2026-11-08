import { describe, expect, it } from "vitest";
import {
  canTransition,
  ENQUIRY_MOVES,
  ENQUIRY_STATUSES,
  LISTING_MOVES,
  LISTING_STATUSES,
} from "../status-machine";

describe("UT-status: the listing machine (S6-T05)", () => {
  const allowed = [
    "draft>pending",
    "pending>approved",
    "pending>rejected",
    "rejected>pending",
    "approved>pending",
    "approved>sold",
    "approved>rented",
  ];

  it("allows exactly the moves the database trigger allows, and no others", () => {
    for (const from of LISTING_STATUSES) {
      for (const to of LISTING_STATUSES) {
        expect(canTransition("listing", from, to), `${from}>${to}`).toBe(
          allowed.includes(`${from}>${to}`),
        );
      }
    }
  });

  it("makes sold and rented final, and lets a rejected listing be resubmitted", () => {
    expect(LISTING_MOVES.sold).toEqual([]);
    expect(LISTING_MOVES.rented).toEqual([]);
    expect(canTransition("listing", "rejected", "pending")).toBe(true);
    expect(canTransition("listing", "rejected", "approved")).toBe(false);
  });

  it("does not count staying where it is as a move", () => {
    for (const status of LISTING_STATUSES)
      expect(canTransition("listing", status, status)).toBe(false);
  });

  it("names every state in the table", () => {
    expect(Object.keys(LISTING_MOVES).sort()).toEqual([...LISTING_STATUSES].sort());
  });
});

describe("UT-status: the enquiry machine (S6-T05)", () => {
  const allowed = ["new>contacted", "new>closed", "contacted>closed"];

  it("moves forward only: new, then contacted, then closed", () => {
    for (const from of ENQUIRY_STATUSES) {
      for (const to of ENQUIRY_STATUSES) {
        expect(canTransition("enquiry", from, to), `${from}>${to}`).toBe(
          allowed.includes(`${from}>${to}`),
        );
      }
    }
  });

  it("names every state in the table, and closed is final", () => {
    expect(Object.keys(ENQUIRY_MOVES).sort()).toEqual([...ENQUIRY_STATUSES].sort());
    expect(ENQUIRY_MOVES.closed).toEqual([]);
  });
});
