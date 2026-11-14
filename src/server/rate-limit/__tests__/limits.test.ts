import { describe, expect, it } from "vitest";
import {
  databaseScope,
  RATE_LIMIT_SCOPES,
  RATE_LIMITS,
  type RateLimitScope,
} from "@/server/rate-limit/limits";

describe("UT-rate-limit: the closed list (plan 07 section 11)", () => {
  it("holds exactly the agreed scopes", () => {
    expect([...RATE_LIMIT_SCOPES].sort()).toEqual(
      [
        "ai_chat_burst",
        "ai_chat_global_day",
        "ai_chat_trial",
        "ai_chat_trial_ip",
        "ai_chat_user_day",
        "admin_decision",
        "admin_edit",
        "builder_edit",
        "email_link",
        "enquiry",
        "form_submit",
        "listing_create",
        "map_search",
        "otp_request",
        "otp_verify",
        "places",
        "project_event",
        "project_lead",
        "project_save",
        "staff_sign_in",
        "upload_url",
      ].sort(),
    );
  });

  it.each<[RateLimitScope, readonly object[]]>([
    ["form_submit", [{ who: "visitor_key", windowSeconds: 3600, max: 5 }]], // BR-61
    ["project_event", [{ who: "visitor", windowSeconds: 60, max: 30 }]], // BR-71
    ["project_lead", [{ who: "visitor", windowSeconds: 3600, max: 5 }]], // BR-72
    ["otp_verify", [{ who: "key", windowSeconds: 3600, max: 10 }]],
    ["enquiry", [{ who: "user", windowSeconds: 86400, max: 10 }]],
    ["listing_create", [{ who: "user", windowSeconds: 86400, max: 10 }]],
    ["upload_url", [{ who: "user", windowSeconds: 3600, max: 30 }]],
    ["admin_decision", [{ who: "user", windowSeconds: 3600, max: 120 }]],
    ["admin_edit", [{ who: "user", windowSeconds: 3600, max: 600 }]],
    ["project_save", [{ who: "user", windowSeconds: 3600, max: 60 }]],
    ["places", [{ who: "visitor", windowSeconds: 60, max: 60 }]],
    ["map_search", [{ who: "visitor", windowSeconds: 60, max: 60 }]],
  ])("%s has the agreed rule", (scope, rules) => {
    expect(RATE_LIMITS[scope]).toEqual(rules);
  });

  it("limits a staff Google sign-in per visitor and per address (S3-T10)", () => {
    expect(RATE_LIMITS.staff_sign_in).toEqual([
      { who: "visitor", windowSeconds: 600, max: 10 },
      { who: "ip", windowSeconds: 3600, max: 30 },
    ]);
  });

  it("limits verification emails per user and per address (owner decision, 3 Nov 2026)", () => {
    expect(RATE_LIMITS.email_link).toEqual([
      { who: "user", windowSeconds: 3600, max: 5 },
      { who: "ip", windowSeconds: 86400, max: 20 },
    ]);
  });

  it("limits a phone code per phone and per address (DEC-31)", () => {
    expect(RATE_LIMITS.otp_request).toEqual([
      { who: "key", windowSeconds: 3600, max: 5 },
      { who: "ip", windowSeconds: 86400, max: 20 },
    ]);
  });

  it("holds the AI chat numbers of ADR-128 section 7 (D9)", () => {
    expect(RATE_LIMITS.ai_chat_trial).toEqual([
      {
        who: "cookie",
        otherwise: ["visitor"],
        windowSeconds: 366 * 86400,
        max: 2,
        only: "anonymous",
      },
    ]);
    expect(RATE_LIMITS.ai_chat_trial_ip).toEqual([
      { who: "network", windowSeconds: 86400, max: 40, only: "anonymous" },
    ]);
    expect(RATE_LIMITS.ai_chat_burst).toEqual([
      { who: "user", otherwise: ["cookie", "visitor"], windowSeconds: 60, max: 10 },
    ]);
    expect(RATE_LIMITS.ai_chat_user_day).toEqual([
      { who: "user", windowSeconds: 86400, max: 40, only: "signed_in" },
    ]);
    expect(RATE_LIMITS.ai_chat_global_day).toEqual([
      { who: "global", windowSeconds: 86400, max: 1000 }, // 1000 is a placeholder: owner to confirm (G-B)
    ]);
  });

  it("names the trial scopes the database keeps for a year, so a rename cannot make them be swept in 7 days", () => {
    const [trial] = RATE_LIMITS.ai_chat_trial;
    expect(databaseScope("ai_chat_trial", trial)).toBe("ai_chat_trial_cookie");
    expect(databaseScope("ai_chat_trial", { ...trial, who: "visitor" })).toBe(
      "ai_chat_trial_visitor",
    );
    // The migration accepts a window of at most 366 days.
    expect(trial.windowSeconds).toBeLessThanOrEqual(31622400);
  });

  it("gives every rule its own database scope, in the form the database accepts", () => {
    const seen = new Set<string>();
    for (const scope of RATE_LIMIT_SCOPES) {
      for (const rule of RATE_LIMITS[scope]) {
        const name = databaseScope(scope, rule);
        expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
        expect(name.length).toBeLessThanOrEqual(40);
        expect(seen.has(name)).toBe(false);
        seen.add(name);
        expect(rule.windowSeconds).toBeGreaterThanOrEqual(1);
        // A day is the longest window, except the AI chat trial: 366 days, as migration 20261114120000 allows.
        expect(rule.windowSeconds).toBeLessThanOrEqual(
          scope === "ai_chat_trial" ? 31622400 : 86400,
        );
        expect(rule.max).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
