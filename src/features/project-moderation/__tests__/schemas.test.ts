import { describe, expect, it } from "vitest";
import { moderateProjectSchema } from "../schemas";

const PROJECT = "00000000-0000-4000-b000-000000000001";

describe("UT-project-moderation-schemas: a feature's start and end dates (ADR-210)", () => {
  it("accepts a feature with no dates, as before", () => {
    expect(moderateProjectSchema.parse({ projectId: PROJECT, decision: "feature" })).toEqual({
      projectId: PROJECT,
      decision: "feature",
    });
  });

  it("keeps real days and reads blank boxes as no day", () => {
    expect(
      moderateProjectSchema.parse({
        projectId: PROJECT,
        decision: "feature",
        featuredFrom: "2026-12-01",
        featuredUntil: "",
      }),
    ).toEqual({ projectId: PROJECT, decision: "feature", featuredFrom: "2026-12-01" });
  });

  it("accepts the same first and last day", () => {
    const parsed = moderateProjectSchema.safeParse({
      projectId: PROJECT,
      decision: "feature",
      featuredFrom: "2026-12-01",
      featuredUntil: "2026-12-01",
    });
    expect(parsed.success).toBe(true);
  });

  it.each(["2026-02-29", "2026-00-10", "2026/12/01", "soon"])(
    "refuses a day that is not a real calendar day: %j",
    (day) => {
      const parsed = moderateProjectSchema.safeParse({
        projectId: PROJECT,
        decision: "feature",
        featuredUntil: day,
      });
      expect(parsed.success).toBe(false);
    },
  );

  it("refuses an end date before the start date, on the end date, with the approved words", () => {
    const parsed = moderateProjectSchema.safeParse({
      projectId: PROJECT,
      decision: "feature",
      featuredFrom: "2026-12-10",
      featuredUntil: "2026-12-09",
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({
        path: ["featuredUntil"],
        message: "validation.promotionDatesOrder",
      }),
    ]);
  });
});
