import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import { formatSentAgo, sentStatusOf } from "../view";

/** A translator that reads en.json with the plural forms English needs, enough for these words. */
function translate(key: string, values?: Record<string, unknown>): string {
  const text = key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], en);
  const count = Number(values?.["count"]);
  return String(text).replace(
    /\{count, plural, one \{([^}]*)\} other \{([^}]*)\}\}/,
    (_match, one, other) => (count === 1 ? one : other).replace("#", String(count)),
  );
}

const NOW = Date.parse("2026-11-06T12:00:00Z");
const ago = (milliseconds: number) => new Date(NOW - milliseconds).toISOString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("sentStatusOf: the status a sender sees", () => {
  it("shows an enquiry nobody has moved yet as waiting for the owner", () => {
    expect(sentStatusOf("new")).toBe("waitingForOwner");
  });

  it("shows the other two as they are", () => {
    expect(sentStatusOf("contacted")).toBe("contacted");
    expect(sentStatusOf("closed")).toBe("closed");
  });
});

describe("formatSentAgo: how long ago an enquiry was sent", () => {
  it.each([
    [30 * 1000, "just now"],
    [MINUTE, "1 minute ago"],
    [59 * MINUTE, "59 minutes ago"],
    [HOUR, "1 hour ago"],
    [23 * HOUR, "23 hours ago"],
    [DAY, "1 day ago"],
    [4 * DAY, "4 days ago"],
  ])("says %d ms ago as %s", (milliseconds, expected) => {
    expect(formatSentAgo(translate as never, ago(milliseconds), NOW)).toBe(expected);
  });

  it("goes on to months and years as the cards do", () => {
    expect(formatSentAgo(translate as never, ago(45 * DAY), NOW)).toBe("1 month ago");
    expect(formatSentAgo(translate as never, ago(800 * DAY), NOW)).toBe("2 years ago");
  });

  it("says just now for a time a little in the future, never a negative number", () => {
    expect(formatSentAgo(translate as never, ago(-5 * MINUTE), NOW)).toBe("just now");
  });

  it("says nothing for a time that is not a date", () => {
    expect(formatSentAgo(translate as never, "yesterday-ish", NOW)).toBe("");
  });
});
