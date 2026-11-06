import { describe, expect, it } from "vitest";
import { isSessionEnded, sessionEndedHref } from "../session-ended";

describe("isSessionEnded: the visitor is no longer signed in with a verified phone (S5-T07)", () => {
  it("is true when the server says the visitor is not signed in", () => {
    expect(isSessionEnded({ code: "UNAUTHENTICATED" })).toBe(true);
  });

  it("is true when the account has no verified phone behind it", () => {
    expect(isSessionEnded({ code: "FORBIDDEN", reason: "PHONE_NOT_VERIFIED" })).toBe(true);
  });

  it("is false for every other refusal, including a plain FORBIDDEN (the visitor's own home)", () => {
    for (const code of [
      "VALIDATION",
      "FORBIDDEN",
      "NOT_FOUND",
      "CONFLICT",
      "RATE_LIMITED",
      "UPSTREAM_FAILED",
      "INTERNAL",
    ] as const) {
      expect(isSessionEnded({ code })).toBe(false);
    }
  });
});

describe("sessionEndedHref: where Sign in again leads", () => {
  it("says why and asks to come back to this page, with the address encoded", () => {
    expect(sessionEndedHref("/properties/3-bhk-velachery")).toBe(
      "/auth?gate=expired&redirect=%2Fproperties%2F3-bhk-velachery",
    );
  });

  it("can ask to come back to an anchor on the page", () => {
    expect(sessionEndedHref("/projects/kadal-vista", "#enquiry")).toBe(
      "/auth?gate=expired&redirect=%2Fprojects%2Fkadal-vista%23enquiry",
    );
  });
});
