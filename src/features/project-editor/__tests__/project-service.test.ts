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
/** A complete residential apartment project that is ready to move and not under RERA: the least a save needs. */
const minimal = {
  name: "Kadal Vista",
  slug: "kadal-vista",
  city: "Chennai",
  locality: "OMR Navalur",
  projectType: "residential",
  propertyType: "apartment",
  projectStatus: "ready_to_move",
  price: "7800000",
  priceType: "basic",
  reraApplicable: false,
  reraNotApplicableReason: "Below the size that needs registration.",
};

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
  it("writes the columns every project has, and none of what does not apply to it", () => {
    expect(projectRowFrom(createMyProjectSchema.parse(minimal))).toEqual({
      name: "Kadal Vista",
      slug: "kadal-vista",
      city: "Chennai",
      locality: "OMR Navalur",
      project_type: "residential",
      property_type: "apartment",
      project_status: "ready_to_move",
      offer_type: null,
      plot_status: null,
      villa_type: null,
      price: 7800000,
      price_type: "basic",
      security_deposit: null,
      maintenance_per_month: null,
      area_min_sqft: null,
      area_max_sqft: null,
      bhk_options: [],
      possession_date: null,
      rera_applicable: false,
      rera_number: null,
      rera_not_applicable_reason: "Below the size that needs registration.",
    });
  });

  it("keeps the deposit and maintenance of a residential project for rent (ADR-214)", () => {
    const row = projectRowFrom(
      createMyProjectSchema.parse({
        ...minimal,
        offerType: "rent",
        price: "28000",
        priceType: "rent_per_month",
        securityDeposit: "1,50,000",
        maintenancePerMonth: "2500",
      }),
    );
    expect(row.offer_type).toBe("rent");
    expect(row.price_type).toBe("rent_per_month");
    expect(row.security_deposit).toBe(150000);
    expect(row.maintenance_per_month).toBe(2500);
  });

  it("maps every box to its column", () => {
    const row = projectRowFrom(
      createMyProjectSchema.parse({
        ...minimal,
        projectStatus: "under_construction",
        price: "7800000",
        bhkOptions: [2, 3],
        landAreaAcres: "4.5",
        possessionDate: "2027-06",
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
      city: "Chennai",
      locality: "OMR Navalur",
      project_type: "residential",
      property_type: "apartment",
      project_status: "under_construction",
      offer_type: null,
      plot_status: null,
      villa_type: null,
      price: 7800000,
      price_type: "basic",
      security_deposit: null,
      maintenance_per_month: null,
      area_min_sqft: null,
      area_max_sqft: null,
      bhk_options: [2, 3],
      land_area_acres: 4.5,
      possession_date: "2027-06-01",
      contact_phone: "+919841055512",
      address: "Navalur, Chennai",
      latitude: 12.84,
      longitude: 80.23,
      advantages: ["Near the IT corridor"],
      nearby: ["Navalur junction"],
      rera_applicable: true,
      rera_number: "TN/29/Building/0123/2026",
      rera_not_applicable_reason: null,
      description: "A gated community.",
      specifications: "RCC framed structure.",
      amenities: ["Clubhouse", "Gym"],
      seo_title: "Kadal Vista",
      seo_description: "Gated homes near the IT corridor.",
    });
  });

  it("writes a plot priced per sq ft with its area range, and no bedrooms even if some were sent", () => {
    const row = projectRowFrom(
      createMyProjectSchema.parse({
        ...minimal,
        propertyType: "plot",
        plotStatus: "ready_to_build",
        villaType: "duplex",
        price: "2,450",
        priceType: "per_sqft",
        areaMinSqft: "1200",
        areaMaxSqft: "2,400.5",
        bhkOptions: [2, 3],
      }),
    );
    expect(row).toMatchObject({
      property_type: "plot",
      plot_status: "ready_to_build",
      villa_type: null,
      price: 2450,
      price_type: "per_sqft",
      area_min_sqft: 1200,
      area_max_sqft: 2400.5,
      bhk_options: [],
      offer_type: null,
    });
  });

  it("writes a villa with its type and no plot status, and a mapped refusal names the box", () => {
    const row = projectRowFrom(
      createMyProjectSchema.parse({
        ...minimal,
        propertyType: "villa",
        villaType: "row_house",
        plotStatus: "investment",
      }),
    );
    expect(row).toMatchObject({
      property_type: "villa",
      villa_type: "row_house",
      plot_status: null,
    });
    expect(
      mapProjectError({ code: "23514", message: "projects.plot_status_required" }),
    ).toMatchObject({ fieldErrors: { plotStatus: [{ key: "validation.required" }] } });
    expect(
      mapProjectError({ code: "23514", message: "projects.villa_type_required" }),
    ).toMatchObject({ fieldErrors: { villaType: [{ key: "validation.required" }] } });
  });

  it("writes a commercial project for rent with its offer type, area range and no bedrooms", () => {
    const row = projectRowFrom(
      createMyProjectSchema.parse({
        ...minimal,
        projectType: "commercial",
        propertyType: "office",
        offerType: "rent",
        priceType: "rent_per_sqft_month",
        price: "85",
        areaMinSqft: "500",
        areaMaxSqft: "2500",
        bhkOptions: [3],
      }),
    );
    expect(row).toMatchObject({
      project_type: "commercial",
      property_type: "office",
      offer_type: "rent",
      price_type: "rent_per_sqft_month",
      price: 85,
      area_min_sqft: 500,
      area_max_sqft: 2500,
      bhk_options: [],
    });
  });

  it("stores a residential project for sale with no choice, and drops the area range of an apartment", () => {
    const row = projectRowFrom(
      createMyProjectSchema.parse({
        ...minimal,
        offerType: "sale",
        securityDeposit: "100000",
        areaMinSqft: "500",
        areaMaxSqft: "900",
      }),
    );
    // ADR-214: a residential project for sale is stored with no choice, as before, and keeps no rent amount.
    expect(row.offer_type).toBeNull();
    expect(row.security_deposit).toBeNull();
    expect(row.area_min_sqft).toBeNull();
    expect(row.area_max_sqft).toBeNull();
  });

  it("keeps the possession month only while the project is still to be built", () => {
    const building = projectRowFrom(
      createMyProjectSchema.parse({
        ...minimal,
        projectStatus: "new_launch",
        possessionDate: "2028-12",
      }),
    );
    expect(building.possession_date).toBe("2028-12-01");
    const ready = projectRowFrom(
      createMyProjectSchema.parse({ ...minimal, possessionDate: "2028-12" }),
    );
    expect(ready.possession_date).toBeNull();
  });

  it("keeps the RERA number only when RERA applies and the reason only when it does not, so a leftover box never blocks a save", () => {
    const without = projectRowFrom(
      createMyProjectSchema.parse({
        ...minimal,
        reraApplicable: false,
        reraNumber: "TN/29/Building/0189/2023",
      }),
    );
    expect(without.rera_number).toBeNull();
    expect(without.rera_applicable).toBe(false);
    expect(without.rera_not_applicable_reason).toBe("Below the size that needs registration.");
    const under = projectRowFrom(
      createMyProjectSchema.parse({
        ...minimal,
        reraApplicable: true,
        reraNumber: "TN/29/Building/0189/2023",
      }),
    );
    expect(under.rera_number).toBe("TN/29/Building/0189/2023");
    expect(under.rera_not_applicable_reason).toBeNull();
  });

  it("clears a column when its box was blanked, and leaves it when it was not sent", () => {
    const row = projectRowFrom(
      updateMyProjectSchema.parse({ projectId: PROJECT, ...minimal, address: "" }),
    );
    expect(row).toMatchObject({ address: null });
    expect("land_area_acres" in row).toBe(false);
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
      { code: "23514", message: "projects.rera_number_required" },
      "reraNumber",
      "validation.required",
    ],
    [
      { code: "23514", message: "projects.rera_reason_required" },
      "reraNotApplicableReason",
      "validation.required",
    ],
    [
      { code: "23514", message: 'violates check constraint "projects_possession_for_status"' },
      "possessionDate",
      "validation.invalid",
    ],
    [
      { code: "23514", message: 'violates check constraint "projects_property_type_fits"' },
      "propertyType",
      "validation.invalid",
    ],
    [
      { code: "23514", message: 'violates check constraint "projects_area_range"' },
      "areaMaxSqft",
      "validation.areaRange",
    ],
    [
      { code: "23514", message: 'violates check constraint "projects_price_type_offer"' },
      "priceType",
      "validation.invalid",
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
