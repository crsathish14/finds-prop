import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EMPLOYMENT_TYPES,
  JOB_APPLY_EMAIL_MAX,
  JOB_APPLY_EMAIL_PATTERN,
  JOB_APPLY_URL_MAX,
  JOB_APPLY_URL_PATTERN,
  JOB_DESCRIPTION_MAX,
  JOB_EXPERIENCE_MAX,
  JOB_LOCATION_MAX,
  JOB_LOCATION_MIN,
  JOB_REQUIREMENTS_MAX,
  JOB_RESPONSIBILITIES_MAX,
  JOB_SALARY_NOTE_MAX,
  JOB_SLUG_MAX,
  JOB_SLUG_MIN,
  JOB_STATUSES,
  JOB_SUMMARY_MAX,
  JOB_TITLE_MAX,
  JOB_TITLE_MIN,
  WORK_MODES,
} from "../constants";

/**
 * The table checks the same limits as the form (ADR-147), so a bad row cannot be stored by any route. This reads the
 * migration as text and fails when a limit here and a limit there drift apart: a change to either needs a new
 * migration and a change to the other.
 */
const SQL = readFileSync(
  join(process.cwd(), "supabase/migrations/20261121100000_job_postings.sql"),
  "utf8",
);

const list = (values: readonly string[]) => values.map((value) => `'${value}'`).join(", ");

describe("UT-careers-migration-parity: the form's limits are the table's", () => {
  it.each([
    ["the title", `char_length(btrim(title)) between ${JOB_TITLE_MIN} and ${JOB_TITLE_MAX}`],
    ["the slug", `char_length(slug) between ${JOB_SLUG_MIN} and ${JOB_SLUG_MAX}`],
    [
      "the location",
      `char_length(btrim(location)) between ${JOB_LOCATION_MIN} and ${JOB_LOCATION_MAX}`,
    ],
    ["the experience", `char_length(experience) <= ${JOB_EXPERIENCE_MAX}`],
    ["the summary", `char_length(summary) <= ${JOB_SUMMARY_MAX}`],
    ["the description", `char_length(description) <= ${JOB_DESCRIPTION_MAX}`],
    ["the responsibilities", `char_length(responsibilities) <= ${JOB_RESPONSIBILITIES_MAX}`],
    ["the requirements", `char_length(requirements) <= ${JOB_REQUIREMENTS_MAX}`],
    ["the salary note", `char_length(btrim(salary_note)) between 1 and ${JOB_SALARY_NOTE_MAX}`],
    ["the apply link's length", `char_length(apply_url) <= ${JOB_APPLY_URL_MAX}`],
    ["the apply email's length", `char_length(apply_email) <= ${JOB_APPLY_EMAIL_MAX}`],
  ])("holds %s to the same limit", (_name, fragment) => {
    expect(SQL).toContain(fragment);
  });

  it("names the same statuses, work modes and employment types", () => {
    expect(SQL).toContain(`status in (${list(JOB_STATUSES)})`);
    expect(SQL).toContain(`work_mode in (${list(WORK_MODES)})`);
    expect(SQL).toContain(`employment_type in (${list(EMPLOYMENT_TYPES)})`);
  });

  it("checks the same apply link and email patterns (https only)", () => {
    expect(SQL).toContain(`apply_url ~ '${JOB_APPLY_URL_PATTERN.source.replaceAll("\\/", "/")}'`);
    expect(SQL).toContain(
      `apply_email ~ '${JOB_APPLY_EMAIL_PATTERN.source.replaceAll("\\/", "/")}'`,
    );
    expect(JOB_APPLY_URL_PATTERN.test("http://jobs.example.test/x")).toBe(false);
  });

  it("requires exactly one way to apply, an open job to be complete and Trash to hold no open job", () => {
    expect(SQL).toContain("num_nonnulls(apply_url, apply_email) = 1");
    expect(SQL).toContain("job_postings_open_is_complete");
    expect(SQL).toContain("deleted_at is null or status <> 'open'");
  });

  it("shows a visitor only open jobs that have not closed and are not in Trash, in the row policy", () => {
    const visible =
      "status = 'open' and deleted_at is null and (closes_at is null or closes_at > now())";
    expect(SQL.split(visible).length - 1).toBeGreaterThanOrEqual(2);
  });
});
