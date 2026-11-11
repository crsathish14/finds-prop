import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient, visitorClient } from "./support/clients";
import {
  createBuilderRecord,
  grantRole,
  removeTestAdmin,
  removeTestUser,
  signInTestAdmin,
  signInTestCustomer,
  type TestUser,
} from "./support/users";

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));
vi.mock("server-only", () => ({}));

const { readAdminOverview } = await import("@/features/admin-overview/queries");

// IT-admin-overview (S7-T06 part 3): what the admin's Overview page reads, against a real database. The function
// counts forms with no project as leads, by India day; only the super admin may call it. The fixtures sit on a day
// in the past, so the other tests' rows (made now) are not in the range.

const RUN = randomUUID().slice(0, 8);
const DAY = "2025-03-10";
// 06:00 UTC is 11:30 on the same day in India.
const AT = `${DAY}T06:00:00Z`;
const NOW = new Date("2026-11-11T06:00:00Z");

describe("IT-admin-overview: the admin's Overview numbers against a real database (S7-T06 part 3)", () => {
  const service = adminClient();
  let staff: TestUser;
  let someone: TestUser;
  const submissions: string[] = [];

  beforeAll(async () => {
    someone = await signInTestCustomer();
    await grantRole(someone.userId, "builder");
    await createBuilderRecord(someone.userId, { active: true });
    staff = await signInTestAdmin();
    for (const name of ["Priya Raman", "Karthik S"]) {
      const { data, error } = await service
        .from("form_submissions")
        .insert({ form_name: `IT Overview ${RUN}`, name, mobile: "9840012345", created_at: AT })
        .select("id")
        .single();
      if (error) throw new Error(`Could not add a submission (${error.code})`);
      submissions.push(data.id);
    }
  });

  afterAll(async () => {
    await service.from("form_submissions").delete().in("id", submissions);
    await removeTestUser();
    await removeTestAdmin();
  });

  it("gives the admin the numbers, in the shape the page checks, with a day of the range for each entry", async () => {
    const overview = await readAdminOverview(staff.client, { from: DAY, to: DAY }, NOW);
    expect(overview.leads.total).toBe(2);
    expect(overview.sources).toEqual({ projectPages: 0, propertyEnquiries: 0, otherForms: 2 });
    expect(overview.daily).toEqual([{ day: DAY, leads: 2, enquiries: 0, shortlists: 0 }]);
    expect(overview.active).toBe(true);
    // Stock and people are of now, whatever the range: the admin and the test customer are in the count.
    expect(overview.people.customers).toBeGreaterThanOrEqual(1);
    expect(overview.people.builders).toBeGreaterThanOrEqual(1);
    expect(overview.listings.total).toBeGreaterThanOrEqual(0);
  });

  it("counts a quiet day as zero, and says nothing happened", async () => {
    const overview = await readAdminOverview(
      staff.client,
      { from: "2025-03-08", to: "2025-03-09" },
      NOW,
    );
    expect(overview.leads.total).toBe(0);
    expect(overview.daily.map((entry) => entry.day)).toEqual(["2025-03-08", "2025-03-09"]);
    expect(overview.active).toBe(false);
    expect(overview.conversion).toBeNull();
  });

  it("refuses a range of more than a year", async () => {
    await expect(
      readAdminOverview(staff.client, { from: "2025-01-01", to: "2026-11-11" }, NOW),
    ).rejects.toMatchObject({ code: "22023" });
  });

  it("refuses a builder, who is signed in but is not the admin", async () => {
    await expect(
      readAdminOverview(someone.client, { from: DAY, to: DAY }, NOW),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("refuses a visitor who is not signed in", async () => {
    await expect(
      readAdminOverview(visitorClient(), { from: DAY, to: DAY }, NOW),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
