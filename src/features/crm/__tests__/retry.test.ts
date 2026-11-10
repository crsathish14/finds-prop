import { describe, expect, it } from "vitest";
import { MAX_ATTEMPTS, RETRY_MINUTES } from "../constants";
import { nextRetryAt, retryDelayMinutes, stateAfterFailure } from "../retry";

const NOW = new Date("2026-11-10T10:00:00.000Z");

describe("UT-retry: the delivery retry schedule (S7-T09, BR-66)", () => {
  it("is 1, 5, 30, 120 and 720 minutes, so six attempts in all", () => {
    expect([...RETRY_MINUTES]).toEqual([1, 5, 30, 120, 720]);
    expect(MAX_ATTEMPTS).toBe(6);
  });

  it.each([
    [1, 1],
    [2, 5],
    [3, 30],
    [4, 120],
    [5, 720],
  ])("after failed attempt %i the next try is in %i minutes", (attempt, minutes) => {
    expect(retryDelayMinutes(attempt)).toBe(minutes);
    expect(nextRetryAt(attempt, NOW)?.toISOString()).toBe(
      new Date(NOW.getTime() + minutes * 60_000).toISOString(),
    );
  });

  it("gives up after the sixth failure, and for numbers that are not an attempt", () => {
    for (const attempt of [6, 7, 100, 0, -1, 1.5, Number.NaN]) {
      expect(retryDelayMinutes(attempt)).toBeNull();
      expect(nextRetryAt(attempt, NOW)).toBeNull();
    }
  });

  it("says whether a failure is the last one", () => {
    expect(stateAfterFailure(5, NOW)).toEqual({
      final: false,
      nextRetryAt: new Date(NOW.getTime() + 720 * 60_000),
    });
    expect(stateAfterFailure(6, NOW)).toEqual({ final: true, nextRetryAt: null });
  });

  it("does not move the clock it was given", () => {
    nextRetryAt(1, NOW);
    expect(NOW.toISOString()).toBe("2026-11-10T10:00:00.000Z");
  });
});
