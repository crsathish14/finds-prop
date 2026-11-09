import { describe, expect, it, vi } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import {
  createMyProjectSchema,
  createProjectSchema,
  updateMyProjectSchema,
  updateProjectSchema,
} from "../schemas";
import {
  addProject,
  mapProjectError,
  projectRowFrom,
  saveProject,
  trendRowsFrom,
  type ProjectDone,
  type ProjectStore,
} from "../project-service";

const BUILDER = "00000000-0000-4000-b000-000000000001";
const PROJECT = "00000000-0000-4000-a000-000000000001";
const FORM = "00000000-0000-4000-9000-000000000001";
const minimal = { name: "Kadal Vista", slug: "kadal-vista", locality: "OMR Navalur" };

const done: ProjectDone = {
  projectId: PROJECT,
  slug: "kadal-vista",
  previousSlug: null,
  moderation: "pending",
  previousModeration: null,
};

function store(overrides: Partial<ProjectStore> = {}): ProjectStore {
  return {
    insert: vi.fn(async () => done),
    update: vi.fn(async () => done),
    saveTrends: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("UT-project-service: the columns a project form gives (S7-T02)", () => {
  it("writes only the name, the address, the locality and the RERA flag when nothing else was given", () => {
    expect(projectRowFrom(createMyProjectSchema.parse(minimal))).toEqual({
      name: "Kadal Vista",
      slug: "kadal-vista",
      locality: "OMR Navalur",
      rera_applicable: false,
      rera_number: null,
    });
  });

  it("maps every box to its column", () => {
    const row = projectRowFrom(
      createMyProjectSchema.parse({
        ...minimal,
        projectType: "residential",
        propertyType: "apartment",
        projectStatus: "under_construction",
        priceMin: "7800000",
        priceMax: "14200000",
        bhkOptions: [2, 3],
        landAreaAcres: "4.5",
        totalUnits: "320",
        possessionDate: "2027-06-30",
        contactPhone: "+91 98410 55512",
        address: "Navalur, Chennai",
        latitude: "12.84",
        longitude: "80.23",
        advantages: ["Near the IT corridor"],
        nearby: ["Navalur junction"],
        reraApplicable: true,
        reraNumber: "TN/29/Building/0123/2026",
        description: "A gated community.",
        specifications: "RCC framed structure.",
        amenities: ["Clubhouse", "Gym"],
        seoTitle: "Kadal Vista",
        seoDescription: "Gated homes near the IT corridor.",
      }),
    );
    expect(row).toEqual({
      name: "Kadal Vista",
      slug: "kadal-vista",
      locality: "OMR Navalur",
      project_type: "residential",
      property_type: "apartment",
      project_status: "under_construction",
      price_min: 7800000,
      price_max: 14200000,
      bhk_options: [2, 3],
      land_area_acres: 4.5,
      total_units: 320,
      possession_date: "2027-06-30",
      contact_phone: "+919841055512",
      address: "Navalur, Chennai",
      latitude: 12.84,
      longitude: 80.23,
      advantages: ["Near the IT corridor"],
      nearby: ["Navalur junction"],
      rera_applicable: true,
      rera_number: "TN/29/Building/0123/2026",
      description: "A gated community.",
      specifications: "RCC framed structure.",
      amenities: ["Clubhouse", "Gym"],
      seo_title: "Kadal Vista",
      seo_description: "Gated homes near the IT corridor.",
    });
  });

  it("keeps the RERA number only when RERA applies, so a leftover box never blocks a save", () => {
    const without = projectRowFrom(
      createMyProjectSchema.parse({ ...minimal, reraApplicable: false, reraNumber: "TN/1" }),
    );
    expect(without.rera_number).toBeNull();
    expect(without.rera_applicable).toBe(false);
  });

  it("clears a column when its box was blanked, and leaves it when it was not sent", () => {
    const row = projectRowFrom(
      updateMyProjectSchema.parse({ projectId: PROJECT, ...minimal, priceMin: "", address: "" }),
    );
    expect(row).toMatchObject({ price_min: null, address: null });
    expect("price_max" in row).toBe(false);
    expect("images" in row).toBe(false);
  });

  it("writes the media on a save, and the enquiry form only when it is the admin's", () => {
    const media = {
      images: [`${PROJECT}/cover.webp`],
      floorPlans: [`${PROJECT}/plan.pdf`],
      brochure: `${PROJECT}/brochure.pdf`,
      videos: ["https://video.example/a"],
    };
    const mine = projectRowFrom(
      updateMyProjectSchema.parse({ projectId: PROJECT, ...minimal, ...media, formId: FORM }),
    );
    expect(mine).toMatchObject({
      images: media.images,
      floor_plans: media.floorPlans,
      brochure_path: media.brochure,
      videos: media.videos,
    });
    expect("form_id" in mine).toBe(false);
    const admins = projectRowFrom(
      updateProjectSchema.parse({ projectId: PROJECT, ...minimal, formId: FORM }),
    );
    expect(admins.form_id).toBe(FORM);
    expect(
      projectRowFrom(updateProjectSchema.parse({ projectId: PROJECT, ...minimal, formId: "" }))
        .form_id,
    ).toBeNull();
  });

  it("gives the months to the database function as the first of each month", () => {
    expect(trendRowsFrom([{ month: "2026-10", pricePerSqft: 8350 }])).toEqual([
      { month: "2026-10-01", price_per_sqft: 8350 },
    ]);
  });
});

describe("UT-project-service: adding and saving (S7-T02)", () => {
  it("adds a builder's own project without naming a builder", async () => {
    const made = store();
    expect(await addProject(made, createMyProjectSchema.parse(minimal))).toEqual(done);
    expect(vi.mocked(made.insert).mock.calls[0]?.[1]).toBeUndefined();
  });

  it("adds the admin's project for the builder they named", async () => {
    const made = store();
    await addProject(made, createProjectSchema.parse({ ...minimal, builderId: BUILDER }));
    expect(vi.mocked(made.insert).mock.calls[0]?.[1]).toBe(BUILDER);
  });

  it("saves the project and answers where it stands", async () => {
    const made = store();
    expect(
      await saveProject(made, updateMyProjectSchema.parse({ projectId: PROJECT, ...minimal })),
    ).toEqual(done);
    expect(made.update).toHaveBeenCalledWith(
      PROJECT,
      expect.objectContaining({ name: "Kadal Vista" }),
    );
    expect(made.saveTrends).not.toHaveBeenCalled();
  });

  it("saves the admin's price trends after the project, only when they were sent", async () => {
    const made = store();
    await saveProject(
      made,
      updateProjectSchema.parse({
        projectId: PROJECT,
        ...minimal,
        priceTrends: [{ month: "2026-10", pricePerSqft: 8350 }],
      }),
    );
    expect(made.saveTrends).toHaveBeenCalledWith(PROJECT, [
      { month: "2026-10-01", price_per_sqft: 8350 },
    ]);
    const without = store();
    await saveProject(without, updateProjectSchema.parse({ projectId: PROJECT, ...minimal }));
    expect(without.saveTrends).not.toHaveBeenCalled();
    const cleared = store();
    await saveProject(
      cleared,
      updateProjectSchema.parse({ projectId: PROJECT, ...minimal, priceTrends: [] }),
    );
    expect(cleared.saveTrends).toHaveBeenCalledWith(PROJECT, []);
  });

  it("says not found when there is no such project, or it is not theirs, and saves no trends", async () => {
    const empty = store({ update: vi.fn(async () => null) });
    await expect(
      saveProject(
        empty,
        updateProjectSchema.parse({ projectId: PROJECT, ...minimal, priceTrends: [] }),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(empty.saveTrends).not.toHaveBeenCalled();
  });
});

describe("UT-project-service: what the database says when it refuses (S7-T02)", () => {
  it.each([
    [
      {
        code: "23505",
        message: 'duplicate key value violates unique constraint "projects_slug_key"',
      },
      "slug",
      "validation.slugTaken",
    ],
    [{ message: "projects.slug_locked" }, "slug", "validation.slugLocked"],
    [
      { code: "23514", message: 'violates check constraint "projects_price_range"' },
      "priceMax",
      "validation.priceRange",
    ],
    [
      { code: "23514", message: 'violates check constraint "projects_coordinates_together"' },
      "longitude",
      "validation.coordinatesTogether",
    ],
    [
      {
        code: "23503",
        message: "violates foreign key constraint",
        details: "Key (builder_id)=(x) is not present",
      },
      "builderId",
      "validation.invalid",
    ],
  ])("puts %j on the %s box", (failure, field, key) => {
    const error = mapProjectError(failure);
    expect(error).toBeInstanceOf(ActionError);
    expect(error).toMatchObject({ code: "VALIDATION", fieldErrors: { [field]: [{ key }] } });
  });

  it.each([
    [{ message: "projects.builder_immutable" }],
    [{ message: "projects.builder_mismatch" }],
    [{ message: "projects.form_admin_only" }],
    [{ message: "projects.initial_values" }],
    [{ message: "projects.moderation_system_only" }],
    [{ code: "42501" }],
  ])("says %j is not allowed", (failure) => {
    expect(mapProjectError(failure)).toMatchObject({ code: "FORBIDDEN" });
  });

  it.each([
    [{ code: "23514", message: "some other check" }, "VALIDATION"],
    [{ code: "22003" }, "VALIDATION"],
    [{ code: "XX000" }, "INTERNAL"],
    [{}, "INTERNAL"],
  ] as const)("maps %j to %s", (failure, code) => {
    expect(mapProjectError(failure)).toMatchObject({ code });
  });
});
