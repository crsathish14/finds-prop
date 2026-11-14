import { describe, expect, it } from "vitest";
import * as enquiries from "@/features/enquiries/action-config";
import * as forms from "@/features/forms/action-config";
import * as listings from "@/features/listings/action-config";
import * as projects from "@/features/projects/action-config";
import { idempotencyScope } from "../scope";

// The table's own rule, copied from supabase/migrations/20261101150000_rate_limits_idempotency.sql.
const TABLE_RULE = /^[a-z][a-z0-9_]*$/;

describe("UT-idempotency-scope: action names become scopes the table accepts", () => {
  it.each([
    ["createListingDraft", "create_listing_draft"],
    ["submitListing", "submit_listing"],
    ["sendEnquiry", "send_enquiry"],
    ["submitProjectForm", "submit_project_form"],
    ["already_snake", "already_snake"],
    ["word", "word"],
  ])("%s becomes %s", (name, expected) => {
    expect(idempotencyScope(name)).toBe(expected);
  });

  it("refuses a name that cannot fit the table, instead of failing in the database", () => {
    expect(() => idempotencyScope("bad-name")).toThrow(/cannot be used as a scope/);
    expect(() => idempotencyScope("1st")).toThrow();
    expect(() => idempotencyScope("a".repeat(41))).toThrow();
  });

  // The bug this guards: "createListingDraft" went to the database as it was and the table's check
  // constraint refused it, so every create failed with INTERNAL on a real project.
  it("fits the table for every action that carries an idempotency key", () => {
    const configs = [enquiries, forms, listings, projects].flatMap((module) =>
      Object.values(module),
    ) as { name?: unknown; idempotencyKey?: unknown }[];
    const claiming = configs.filter(
      (config) => typeof config.name === "string" && typeof config.idempotencyKey === "function",
    );
    expect(claiming.length).toBeGreaterThanOrEqual(6);
    for (const config of claiming) {
      expect(idempotencyScope(config.name as string)).toMatch(TABLE_RULE);
    }
  });
});
