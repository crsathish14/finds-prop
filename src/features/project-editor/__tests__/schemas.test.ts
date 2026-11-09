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

const minimal = { name: "Kadal Vista", slug: "kadal-vista", locality: "OMR Navalur" };

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

  it("reads prices, area and units typed with commas, and keeps a blank box as no value", () => {
    const parsed = createMyProjectSchema.parse({
      ...minimal,
      priceMin: "78,00,000",
      priceMax: " 1,42,00,000 ",
      landAreaAcres: "4.25",
      totalUnits: "320",
      address: "",
      possessionDate: "",
    });
    expect(parsed).toMatchObject({
      priceMin: 7800000,
      priceMax: 14200000,
      landAreaAcres: 4.25,
      totalUnits: 320,
      address: null,
      possessionDate: null,
    });
  });

  const refused: [string, string, string, Record<string, string>?][] = [
    ["priceMin", "free", "priceMin:validation.numberInvalid"],
    ["priceMin", "-1", "priceMin:validation.invalid"],
    ["landAreaAcres", "1.234", "landAreaAcres:validation.invalid"],
    ["totalUnits", "1.5", "totalUnits:validation.numberInvalid"],
    ["possessionDate", "2026-02-30", "possessionDate:validation.invalid"],
    ["latitude", "91", "latitude:validation.invalid", { longitude: "80.2" }],
    ["longitude", "181", "longitude:validation.invalid", { latitude: "13.0" }],
    ["projectType", "castle", "projectType:validation.invalid"],
    ["contactPhone", "12ab", "contactPhone:validation.phoneInvalid"],
  ];

  it.each(refused)("refuses %s of %j", (field, value, message, extra) => {
    expect(problems(createMyProjectSchema, { ...minimal, ...extra, [field]: value })).toEqual([
      message,
    ]);
  });

  it("puts a price range that runs backwards on the 'to' box", () => {
    expect(
      problems(createMyProjectSchema, { ...minimal, priceMin: "200", priceMax: "100" }),
    ).toEqual(["priceMax:validation.priceRange"]);
    expect(
      problems(createMyProjectSchema, { ...minimal, priceMin: "100", priceMax: "100" }),
    ).toEqual([]);
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
    expect(createMyProjectSchema.parse({ ...minimal, reraApplicable: "on" }).reraApplicable).toBe(
      true,
    );
    expect(createMyProjectSchema.parse({ ...minimal, reraApplicable: true }).reraApplicable).toBe(
      true,
    );
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
