import { describe, expect, it } from "vitest";
import {
  createMyProjectSchema,
  createProjectSchema,
  updateMyProjectSchema,
  updateProjectSchema,
} from "../schemas";

const BUILDER = "00000000-0000-4000-b000-000000000001";
const PROJECT = "00000000-0000-4000-a000-000000000001";
const FORM = "00000000-0000-4000-9000-000000000001";

/** A complete residential apartment project that is ready to move and not under RERA: the least a save needs. */
const minimal = {
  name: "Kadal Vista",
  slug: "kadal-vista",
  locality: "OMR Navalur",
  projectType: "residential",
  propertyType: "apartment",
  projectStatus: "ready_to_move",
  price: "78,00,000",
  priceType: "basic",
  reraApplicable: false,
  reraNotApplicableReason: "Below the size that needs registration.",
};

/** The messages the schema gives, by box. */
const problems = (schema: { safeParse: (input: unknown) => unknown }, input: unknown) => {
  const result = schema.safeParse(input) as {
    success: boolean;
    error?: { issues: { path: PropertyKey[]; message: string }[] };
  };
  if (result.success) return [];
  return (result.error?.issues ?? []).map((issue) => `${issue.path.join(".")}:${issue.message}`);
};

describe("UT-project-schemas: the boxes of the project form (S7-T02)", () => {
  it("takes a name, an address and a locality, and tidies them", () => {
    const parsed = createMyProjectSchema.parse({
      ...minimal,
      name: "  Kadal   Vista ",
      slug: " Kadal-Vista ",
      locality: " OMR  Navalur ",
    });
    expect(parsed).toMatchObject({
      name: "Kadal Vista",
      slug: "kadal-vista",
      locality: "OMR Navalur",
      reraApplicable: false,
    });
  });

  it.each([
    ["name", { ...minimal, name: "K" }, "name:validation.required"],
    ["locality", { ...minimal, locality: " " }, "locality:validation.required"],
    ["slug with spaces", { ...minimal, slug: "kadal vista" }, "slug:validation.slugInvalid"],
    [
      "slug with a double hyphen",
      { ...minimal, slug: "kadal--vista" },
      "slug:validation.slugInvalid",
    ],
    ["slug too short", { ...minimal, slug: "k" }, "slug:validation.slugInvalid"],
  ])("refuses a bad %s", (_label, input, message) => {
    expect(problems(createMyProjectSchema, input)).toEqual([message]);
  });

  it("reads the price and the area typed with commas, and keeps a blank box as no value", () => {
    const parsed = createMyProjectSchema.parse({
      ...minimal,
      price: " 1,42,00,000 ",
      landAreaAcres: "4.25",
      address: "",
      possessionDate: "",
    });
    expect(parsed).toMatchObject({
      price: 14200000,
      landAreaAcres: 4.25,
      address: null,
      possessionDate: null,
    });
  });

  const refused: [string, string, string, Record<string, string>?][] = [
    ["price", "free", "price:validation.numberInvalid"],
    ["price", "-1", "price:validation.invalid"],
    ["price", "0", "price:validation.invalid"],
    ["price", "12.5", "price:validation.numberInvalid"],
    ["price", "", "price:validation.required"],
    ["priceType", "", "priceType:validation.required"],
    ["priceType", "weekly", "priceType:validation.invalid"],
    ["projectType", "", "projectType:validation.required"],
    ["projectType", "castle", "projectType:validation.invalid"],
    ["projectType", "plotted_layout", "projectType:validation.invalid"],
    ["propertyType", "", "propertyType:validation.required"],
    ["propertyType", "house", "propertyType:validation.invalid"],
    ["projectStatus", "", "projectStatus:validation.required"],
    ["landAreaAcres", "1.234", "landAreaAcres:validation.invalid"],
    ["possessionDate", "2026-02-30", "possessionDate:validation.invalid"],
    ["possessionDate", "2026-13", "possessionDate:validation.invalid"],
    ["latitude", "91", "latitude:validation.invalid", { longitude: "80.2" }],
    ["longitude", "181", "longitude:validation.invalid", { latitude: "13.0" }],
    ["contactPhone", "12ab", "contactPhone:validation.phoneInvalid"],
  ];

  it.each(refused)("refuses %s of %j", (field, value, message, extra) => {
    expect(problems(createMyProjectSchema, { ...minimal, ...extra, [field]: value })).toEqual([
      message,
    ]);
  });

  it("reads the possession month as the first day of that month", () => {
    const parsed = createMyProjectSchema.parse({
      ...minimal,
      projectStatus: "under_construction",
      possessionDate: "2028-12",
    });
    expect(parsed.possessionDate).toBe("2028-12-01");
  });
  it("needs both coordinates or neither, and says which box is missing", () => {
    expect(
      problems(createMyProjectSchema, { ...minimal, latitude: "13.0", longitude: "" }),
    ).toEqual(["longitude:validation.coordinatesTogether"]);
    expect(problems(createMyProjectSchema, { ...minimal, longitude: "80.2" })).toEqual([
      "latitude:validation.coordinatesTogether",
    ]);
    expect(
      problems(createMyProjectSchema, { ...minimal, latitude: "13.0", longitude: "80.2" }),
    ).toEqual([]);
  });

  it("cleans the phone of spaces and brackets", () => {
    expect(
      createMyProjectSchema.parse({ ...minimal, contactPhone: "+91 (98410) 55512" }).contactPhone,
    ).toBe("+919841055512");
  });

  it("reads the bedrooms ticked, each once and in order, 0 to 10", () => {
    expect(
      createMyProjectSchema.parse({ ...minimal, bhkOptions: ["3", 2, "2", 4] }).bhkOptions,
    ).toEqual([2, 3, 4]);
    expect(problems(createMyProjectSchema, { ...minimal, bhkOptions: [11] })).toEqual([
      "bhkOptions.0:validation.invalid",
    ]);
  });

  it("tidies a list of tags: trimmed, empty ones and repeats dropped", () => {
    const parsed = createMyProjectSchema.parse({
      ...minimal,
      advantages: [" Near the beach ", "", "near the beach", "IT corridor"],
    });
    expect(parsed.advantages).toEqual(["Near the beach", "IT corridor"]);
  });

  it("refuses more tags than the lists hold", () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_unused, index) => `item ${index}`);
    expect(problems(createMyProjectSchema, { ...minimal, advantages: many(21) })).toEqual([
      "advantages:validation.invalid",
    ]);
    expect(problems(createMyProjectSchema, { ...minimal, amenities: many(31) })).toEqual([
      "amenities:validation.invalid",
    ]);
    expect(problems(createMyProjectSchema, { ...minimal, amenities: many(30) })).toEqual([]);
  });

  it("reads RERA as yes or no", () => {
    const withNumber = { ...minimal, reraNumber: "TN/1" };
    expect(
      createMyProjectSchema.parse({ ...withNumber, reraApplicable: "on" }).reraApplicable,
    ).toBe(true);
    expect(
      createMyProjectSchema.parse({ ...withNumber, reraApplicable: true }).reraApplicable,
    ).toBe(true);
    expect(createMyProjectSchema.parse(minimal).reraApplicable).toBe(false);
  });
});

describe("UT-project-schemas: the admin's extras (S7-T02)", () => {
  it("needs the builder the project is for, and takes the enquiry form or none", () => {
    expect(problems(createProjectSchema, minimal)).toEqual(["builderId:validation.invalid"]);
    expect(createProjectSchema.parse({ ...minimal, builderId: BUILDER, formId: FORM }).formId).toBe(
      FORM,
    );
    expect(
      createProjectSchema.parse({ ...minimal, builderId: BUILDER, formId: "" }).formId,
    ).toBeNull();
  });

  it("does not take a builder or an enquiry form from a builder's own form", () => {
    const parsed = createMyProjectSchema.parse({ ...minimal, builderId: BUILDER, formId: FORM });
    expect("builderId" in parsed).toBe(false);
    expect("formId" in parsed).toBe(false);
  });
});

describe("UT-project-schemas: media and price trends on a save (S7-T02)", () => {
  const own = (file: string) => `${PROJECT}/${file}`;
  const save = (extra: Record<string, unknown>) => ({ projectId: PROJECT, ...minimal, ...extra });

  it("takes files that live in the project's own folder", () => {
    const parsed = updateMyProjectSchema.parse(
      save({
        images: [own("cover.webp"), own("tower-2.jpg")],
        floorPlans: [own("plan-a.pdf")],
        brochure: own("brochure.pdf"),
        videos: ["https://video.example/walkthrough", ""],
      }),
    );
    expect(parsed).toMatchObject({
      images: [own("cover.webp"), own("tower-2.jpg")],
      brochure: own("brochure.pdf"),
      videos: ["https://video.example/walkthrough"],
    });
  });

  it("refuses a file from another project's folder, a path that climbs out, and a brochure that is not ours", () => {
    const other = "00000000-0000-4000-a000-000000000002";
    expect(problems(updateMyProjectSchema, save({ images: [`${other}/cover.webp`] }))).toEqual([
      "images:validation.invalid",
    ]);
    expect(problems(updateMyProjectSchema, save({ images: [own("../secret.webp")] }))).toEqual([
      "images.0:validation.invalid",
    ]);
    expect(problems(updateMyProjectSchema, save({ brochure: `${other}/b.pdf` }))).toEqual([
      "brochure:validation.invalid",
    ]);
  });

  it("refuses too many files and links, and a video that is not an https link", () => {
    const files = Array.from({ length: 21 }, (_unused, index) => own(`photo-${index}.jpg`));
    expect(problems(updateMyProjectSchema, save({ images: files }))).toEqual([
      "images:validation.invalid",
    ]);
    expect(problems(updateMyProjectSchema, save({ videos: ["http://v.example/a"] }))).toEqual([
      "videos.0:validation.linkInvalid",
    ]);
    const links = Array.from({ length: 6 }, (_unused, index) => `https://v.example/${index}`);
    expect(problems(updateMyProjectSchema, save({ videos: links }))).toEqual([
      "videos:validation.invalid",
    ]);
  });

  it("takes price trends from the admin: months and prices typed as text, each month once", () => {
    const parsed = updateProjectSchema.parse(
      save({
        priceTrends: [
          { month: "2026-10", pricePerSqft: "8,350" },
          { month: "2026-09", pricePerSqft: 8230 },
        ],
      }),
    );
    expect(parsed.priceTrends).toEqual([
      { month: "2026-10", pricePerSqft: 8350 },
      { month: "2026-09", pricePerSqft: 8230 },
    ]);
  });

  it.each([
    [[{ month: "2026-13", pricePerSqft: 8000 }], "priceTrends.0.month:validation.invalid"],
    [[{ month: "2026-10", pricePerSqft: 0 }], "priceTrends.0.pricePerSqft:validation.invalid"],
    [
      [{ month: "2026-10", pricePerSqft: "x" }],
      "priceTrends.0.pricePerSqft:validation.numberInvalid",
    ],
    [
      [
        { month: "2026-10", pricePerSqft: 8000 },
        { month: "2026-10", pricePerSqft: 8100 },
      ],
      "priceTrends:validation.invalid",
    ],
  ])("refuses price trends %j", (priceTrends, message) => {
    expect(problems(updateProjectSchema, save({ priceTrends }))).toEqual([message]);
  });

  it("does not take price trends or an enquiry form from a builder's own save", () => {
    const parsed = updateMyProjectSchema.parse(
      save({ formId: FORM, priceTrends: [{ month: "2026-10", pricePerSqft: 8000 }] }),
    );
    expect("formId" in parsed).toBe(false);
    expect("priceTrends" in parsed).toBe(false);
  });
});

describe("UT-project-schemas: the rules between boxes (ADR-148)", () => {
  const parse = (input: Record<string, unknown>) => problems(createMyProjectSchema, input);
  const commercial = {
    ...minimal,
    projectType: "commercial",
    propertyType: "office",
    offerType: "sale",
    areaMinSqft: "500",
    areaMaxSqft: "2,500",
  };
  const plot = {
    ...minimal,
    propertyType: "plot",
    plotStatus: "investment",
    priceType: "per_sqft",
    price: "2450",
    areaMinSqft: "1200",
    areaMaxSqft: "2400",
  };

  it("accepts a residential project of each property type and a commercial one of each", () => {
    expect(parse({ ...minimal, propertyType: "villa", villaType: "duplex" })).toEqual([]);
    expect(parse(plot)).toEqual([]);
    for (const propertyType of ["vacant_land", "flat", "office", "co_working", "villa"]) {
      expect(parse({ ...commercial, propertyType, villaType: "individual" })).toEqual([]);
    }
  });

  it("refuses a property type that does not go with the project type", () => {
    expect(parse({ ...minimal, propertyType: "office" })).toEqual([
      "propertyType:validation.invalid",
    ]);
    expect(parse({ ...commercial, propertyType: "apartment" })).toEqual([
      "propertyType:validation.invalid",
    ]);
    expect(parse({ ...commercial, propertyType: "plot", plotStatus: "investment" })).toEqual([
      "propertyType:validation.invalid",
    ]);
  });

  it("needs the plot status for a plot and the villa type for a villa, and ignores them elsewhere (ADR-160)", () => {
    expect(parse({ ...plot, plotStatus: "" })).toEqual(["plotStatus:validation.required"]);
    expect(parse({ ...plot, plotStatus: "sold" })).toEqual(["plotStatus:validation.invalid"]);
    expect(parse({ ...plot, plotStatus: "ready_to_build" })).toEqual([]);
    const villa = { ...minimal, propertyType: "villa" };
    expect(parse(villa)).toEqual(["villaType:validation.required"]);
    expect(parse({ ...villa, villaType: "bungalow" })).toEqual(["villaType:validation.invalid"]);
    for (const villaType of ["duplex", "row_house", "individual"]) {
      expect(parse({ ...villa, villaType })).toEqual([]);
    }
    expect(parse({ ...commercial, propertyType: "villa" })).toEqual([
      "villaType:validation.required",
    ]);
    expect(parse({ ...minimal, plotStatus: "investment", villaType: "duplex" })).toEqual([]);
  });

  it("needs sale or rent for a commercial project, and ignores it for a residential one", () => {
    expect(parse({ ...commercial, offerType: "" })).toEqual(["offerType:validation.required"]);
    expect(parse({ ...commercial, offerType: "lease" })).toEqual(["offerType:validation.invalid"]);
    expect(parse({ ...minimal, offerType: "rent" })).toEqual([]);
  });

  it("offers the sale price types for sale and the rent ones for rent", () => {
    for (const priceType of ["per_sqft", "basic", "all_inclusive"]) {
      expect(parse({ ...commercial, priceType })).toEqual([]);
      expect(parse({ ...commercial, offerType: "rent", priceType })).toEqual([
        "priceType:validation.invalid",
      ]);
    }
    for (const priceType of ["rent_per_month", "rent_per_sqft_month"]) {
      expect(parse({ ...commercial, offerType: "rent", priceType })).toEqual([]);
      expect(parse({ ...commercial, priceType })).toEqual(["priceType:validation.invalid"]);
      expect(parse({ ...minimal, priceType })).toEqual(["priceType:validation.invalid"]);
    }
  });

  it("needs the smallest and the largest area for a plot and a commercial project, in order", () => {
    expect(parse({ ...plot, areaMinSqft: "", areaMaxSqft: "" })).toEqual([
      "areaMinSqft:validation.required",
      "areaMaxSqft:validation.required",
    ]);
    expect(parse({ ...plot, areaMaxSqft: "" })).toEqual(["areaMaxSqft:validation.required"]);
    expect(parse({ ...plot, areaMinSqft: "2400", areaMaxSqft: "1200" })).toEqual([
      "areaMaxSqft:validation.areaRange",
    ]);
    expect(parse({ ...plot, areaMinSqft: "1200", areaMaxSqft: "1200" })).toEqual([]);
    expect(parse({ ...plot, areaMinSqft: "0" })).toEqual(["areaMinSqft:validation.invalid"]);
    expect(parse({ ...commercial, areaMinSqft: "" })).toEqual(["areaMinSqft:validation.required"]);
  });

  it("does not ask an apartment for an area", () => {
    expect(parse({ ...minimal, areaMinSqft: "", areaMaxSqft: "" })).toEqual([]);
  });

  it("needs the possession month for a new launch and a project under construction, not a ready one", () => {
    for (const projectStatus of ["new_launch", "under_construction"]) {
      expect(parse({ ...minimal, projectStatus })).toEqual(["possessionDate:validation.required"]);
      expect(parse({ ...minimal, projectStatus, possessionDate: "2028-12" })).toEqual([]);
    }
    expect(parse({ ...minimal, possessionDate: "" })).toEqual([]);
  });

  it("needs the RERA number when RERA applies and the reason when it does not", () => {
    expect(parse({ ...minimal, reraApplicable: true, reraNotApplicableReason: "" })).toEqual([
      "reraNumber:validation.required",
    ]);
    expect(
      parse({ ...minimal, reraApplicable: true, reraNumber: "TN/1", reraNotApplicableReason: "" }),
    ).toEqual([]);
    expect(parse({ ...minimal, reraNotApplicableReason: " " })).toEqual([
      "reraNotApplicableReason:validation.required",
    ]);
    expect(parse({ ...minimal, reraNotApplicableReason: "x".repeat(301) })).toEqual([
      "reraNotApplicableReason:validation.invalid",
    ]);
  });
});
