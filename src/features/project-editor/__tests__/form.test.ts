import { describe, expect, it } from "vitest";
import type { ProjectFieldValues } from "@/components/domain/project-fields";
import {
  EMPTY_PROJECT_VALUES,
  appliesOf,
  displayNameOf,
  errorFieldOf,
  fileProblem,
  itemOfPath,
  mediaOf,
  payloadOf,
  projectProblems,
  publicMediaUrl,
  reconcile,
  sectionOfError,
  sectionStatesOf,
  slugFromName,
  trendProblems,
  trendRowsOf,
  trendsToSend,
  uploadPath,
  valuesOf,
  type ProjectFormState,
} from "../form";
import type { ProjectEditView } from "../view";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const BASE = "https://storage.example.test";

const project: ProjectEditView = {
  id: PROJECT_ID,
  name: "Kadal Vista",
  slug: "kadal-vista",
  builderId: "22222222-2222-4222-8222-222222222222",
  projectType: "residential",
  propertyType: null,
  offerType: null,
  plotStatus: null,
  villaType: null,
  extraFields: {},
  projectStatus: "under_construction",
  price: 7800000,
  priceType: "basic",
  areaMinSqft: null,
  areaMaxSqft: null,
  bhkOptions: [2, 3],
  landAreaAcres: 4.2,
  possessionDate: "2028-12-01",
  contactPhone: null,
  locality: "OMR Navalur",
  address: null,
  latitude: 12.8451,
  longitude: 80.2262,
  advantages: ["Near the beach road"],
  nearby: [],
  reraApplicable: true,
  reraNumber: "TN/SAMPLE/0000",
  reraNotApplicableReason: null,
  description: null,
  specifications: null,
  amenities: ["Gym"],
  seoTitle: null,
  seoDescription: null,
  images: [`${PROJECT_ID}/3f2a9c1b-front-view.jpg`, `${PROJECT_ID}/aa00bb11-lobby.png`],
  floorPlans: [],
  elevations: [],
  plotImages: [],
  videos: ["https://www.example.com/watch/tour"],
  brochure: `${PROJECT_ID}/0d0d0d0d-brochure.pdf`,
  formId: null,
  moderation: "approved",
  published: true,
  featured: false,
  rejectionReason: null,
  trends: [
    { month: "2026-09", pricePerSqft: 8230 },
    { month: "2026-10", pricePerSqft: 8350 },
  ],
};

describe("UT-project-form-helpers: what the form opens with and sends (S7-T02)", () => {
  it("fills every box from a saved project, with a blank box for what is not given", () => {
    const values = valuesOf(project);
    expect(values.name).toBe("Kadal Vista");
    expect(values.price).toBe("7800000");
    expect(values.priceType).toBe("basic");
    expect(values.offerType).toBe("");
    expect(values.areaMinSqft).toBe("");
    expect(values.landAreaAcres).toBe("4.2");
    expect(values.latitude).toBe("12.8451");
    expect(values.propertyType).toBe("");
    expect(values.address).toBe("");
    // The month box holds the month; the project keeps its first day.
    expect(values.possessionDate).toBe("2028-12");
    expect(values.reraApplicable).toBe(true);
    expect(values.bhkOptions).toEqual([2, 3]);
    expect(Object.keys(values).sort()).toEqual(Object.keys(EMPTY_PROJECT_VALUES).sort());
  });

  it("does not claim RERA for a new project", () => {
    expect(EMPTY_PROJECT_VALUES.reraApplicable).toBe(false);
  });
});

describe("UT-slug-from-name: the page address a name suggests (S7-T02)", () => {
  it.each([
    ["Kadal Vista", "kadal-vista"],
    ["  Kadal   Vista  Phase-2 ", "kadal-vista-phase-2"],
    ["Café Résidence & Spa!", "cafe-residence-spa"],
    ["---", ""],
    ["", ""],
  ])("%j becomes %j", (name, slug) => {
    expect(slugFromName(name)).toBe(slug);
  });

  it("is cut to 80 characters without a trailing hyphen", () => {
    const slug = slugFromName(`${"a".repeat(79)} b`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("gives an address the server accepts", () => {
    expect(slugFromName("Navalur Heights 2 & 3 BHK")).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe("UT-project-form-errors: where a failure goes (S7-T02)", () => {
  it("names the box of a failure, whatever follows the dot", () => {
    expect(errorFieldOf("slug")).toBe("slug");
    expect(errorFieldOf("images.2")).toBe("images");
    expect(errorFieldOf("priceTrends.0.month")).toBe("priceTrends");
    expect(errorFieldOf("formId")).toBe("formId");
    expect(errorFieldOf("somethingElse")).toBeNull();
    expect(errorFieldOf("")).toBeNull();
  });

  it("puts each box in its section, and the side boxes in none", () => {
    expect(sectionOfError("price")).toBe("basics");
    expect(sectionOfError("areaMaxSqft")).toBe("basics");
    expect(sectionOfError("reraNotApplicableReason")).toBe("rera");
    expect(sectionOfError("longitude")).toBe("location");
    expect(sectionOfError("reraNumber")).toBe("rera");
    expect(sectionOfError("amenities")).toBe("details");
    expect(sectionOfError("brochure")).toBe("media");
    expect(sectionOfError("videos")).toBe("media");
    expect(sectionOfError("slug")).toBe("seo");
    expect(sectionOfError("formId")).toBeNull();
    expect(sectionOfError("priceTrends")).toBeNull();
  });
});

describe("UT-section-states: what the section list shows (S7-T02)", () => {
  const states = (
    overrides: Partial<Omit<Parameters<typeof sectionStatesOf>[0], "values">> & {
      values?: Partial<ProjectFieldValues>;
    },
  ) =>
    sectionStatesOf({
      values: { ...EMPTY_PROJECT_VALUES, ...overrides.values },
      errorSections: overrides.errorSections ?? new Set(),
      needsBuilder: overrides.needsBuilder ?? false,
      hasMedia: overrides.hasMedia ?? false,
    });

  it("shows nothing done for an empty form", () => {
    const result = states({});
    expect(result).toEqual({
      basics: "idle",
      location: "idle",
      rera: "idle",
      details: "idle",
      media: "idle",
      seo: "idle",
    });
  });

  it("marks a section done when what it needs is filled in", () => {
    const result = states({
      needsBuilder: true,
      hasMedia: true,
      values: { name: "Kadal Vista", builderId: "b", locality: "Navalur", slug: "kadal-vista" },
    });
    expect(result.basics).toBe("done");
    expect(result.location).toBe("done");
    expect(result.seo).toBe("done");
    expect(result.media).toBe("done");
  });

  it("needs the builder for the admin's new project, and the RERA number once RERA applies", () => {
    expect(states({ needsBuilder: true, values: { name: "Kadal Vista" } }).basics).toBe("idle");
    expect(states({ values: { reraApplicable: true } }).rera).toBe("idle");
    expect(states({ values: { reraApplicable: true, reraNumber: "TN/1" } }).rera).toBe("done");
  });

  it("needs the reason once RERA does not apply", () => {
    expect(states({ values: { reraApplicable: false } }).rera).toBe("idle");
    expect(
      states({ values: { reraApplicable: false, reraNotApplicableReason: "Small layout" } }).rera,
    ).toBe("done");
  });

  it("shows a problem over everything else", () => {
    const result = states({
      errorSections: new Set(["basics"]),
      values: { name: "Kadal Vista" },
    });
    expect(result.basics).toBe("error");
  });
});

describe("UT-project-media-paths: files in the bucket (S7-T02)", () => {
  it("builds the public address of a file, each part encoded and the slash kept", () => {
    expect(publicMediaUrl(`${BASE}/`, `${PROJECT_ID}/ab cd-x.jpg`)).toBe(
      `${BASE}/storage/v1/object/public/project-media/${PROJECT_ID}/ab%20cd-x.jpg`,
    );
  });

  it("shows a stored name without the short id before it", () => {
    expect(displayNameOf(`${PROJECT_ID}/3f2a9c1b-front-view.jpg`)).toBe("front-view.jpg");
    expect(displayNameOf(`${PROJECT_ID}/plain.jpg`)).toBe("plain.jpg");
  });

  it("turns a path into a finished tile: a picture with a preview, a PDF without one", () => {
    expect(itemOfPath(BASE, `${PROJECT_ID}/3f2a9c1b-front-view.jpg`)).toEqual({
      id: `${PROJECT_ID}/3f2a9c1b-front-view.jpg`,
      name: "front-view.jpg",
      kind: "image",
      previewUrl: `${BASE}/storage/v1/object/public/project-media/${PROJECT_ID}/3f2a9c1b-front-view.jpg`,
      stage: "done",
    });
    const brochure = itemOfPath(BASE, `${PROJECT_ID}/0d0d0d0d-brochure.PDF`);
    expect(brochure.kind).toBe("file");
    expect(brochure.previewUrl).toBeUndefined();
  });

  it("fills each group from a saved project, the brochure as a group of one", () => {
    const media = mediaOf(BASE, project);
    expect(media.images.map((item) => item.name)).toEqual(["front-view.jpg", "lobby.png"]);
    expect(media.floorPlans).toEqual([]);
    expect(media.brochure.map((item) => item.name)).toEqual(["brochure.pdf"]);
    expect(mediaOf(BASE, null).brochure).toEqual([]);
  });

  it("offers pictures to the image groups and PDF to the brochure, up to 10 MB", () => {
    expect(fileProblem({ type: "image/png", size: 1000 }, "floorPlans")).toBeNull();
    expect(fileProblem({ type: "image/webp", size: 10 * 1024 * 1024 }, "images")).toBeNull();
    expect(fileProblem({ type: "image/png", size: 10 * 1024 * 1024 + 1 }, "images")).toBe("size");
    expect(fileProblem({ type: "application/pdf", size: 1000 }, "images")).toBe("type");
    expect(fileProblem({ type: "image/png", size: 1000 }, "brochure")).toBe("type");
    expect(fileProblem({ type: "application/pdf", size: 1000 }, "brochure")).toBeNull();
    expect(fileProblem({ type: "image/gif", size: 1000 }, "plotImages")).toBe("type");
  });

  it("names an upload inside the project's folder, in the form the server accepts", () => {
    const server = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
    const path = uploadPath(
      PROJECT_ID,
      "9E8D7C6B-1111-4222-8333-444455556666",
      { name: "Front View (final)!.JPEG", type: "image/jpeg" },
      "images",
    );
    expect(path).toBe(`${PROJECT_ID}/9e8d7c6b-Front-View-final.jpg`);
    expect(path).toMatch(server);
  });

  it("keeps an odd or very long name inside the server's limits", () => {
    const server = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
    const odd = uploadPath(
      PROJECT_ID,
      "abcdef12-0000-4000-8000-000000000000",
      { name: "பிளான்.pdf", type: "application/pdf" },
      "brochure",
    );
    expect(odd).toBe(`${PROJECT_ID}/abcdef12-file.pdf`);
    expect(odd).toMatch(server);
    const long = uploadPath(
      PROJECT_ID,
      "abcdef12-0000-4000-8000-000000000000",
      { name: `${"x".repeat(300)}.png`, type: "image/png" },
      "images",
    );
    expect(long).toMatch(server);
  });
});

describe("UT-trend-problems: the price trends before a save (S7-T02)", () => {
  const row = (id: string, month: string, price: string) => ({ id, month, price });

  it("finds nothing wrong with good rows, and leaves a blank row out", () => {
    const rows = [row("r1", "2026-10", "8350"), row("r2", "2026-09", "8,230"), row("r3", "", "")];
    expect(trendProblems(rows)).toEqual({});
    expect(trendsToSend(rows)).toEqual([
      { month: "2026-10", pricePerSqft: "8350" },
      { month: "2026-09", pricePerSqft: "8,230" },
    ]);
  });

  it("flags a missing month or price, a month twice and a price that is not a whole number or out of range", () => {
    const found = trendProblems([
      row("r1", "2026-10", "8350"),
      row("r2", "2026-10", "8100"),
      row("r3", "", "8000"),
      row("r4", "2026-07", ""),
      row("r5", "2026-06", "eight"),
      row("r6", "2026-05", "12.5"),
      row("r7", "2026-04", "0"),
      row("r8", "2026-03", "10000001"),
    ]);
    expect(found).toEqual({
      r2: { month: "twice" },
      r3: { month: "missing" },
      r4: { price: "missing" },
      r5: { price: "number" },
      r6: { price: "number" },
      r7: { price: "range" },
      r8: { price: "range" },
    });
  });

  it("opens the box with the saved months, in order", () => {
    expect(trendRowsOf(project)).toEqual([
      { id: "2026-09", month: "2026-09", price: "8230" },
      { id: "2026-10", month: "2026-10", price: "8350" },
    ]);
    expect(trendRowsOf(null)).toEqual([]);
  });
});

describe("UT-project-payload: what a save sends (S7-T02)", () => {
  const state: ProjectFormState = {
    values: { ...valuesOf(project), builderId: project.builderId },
    formId: "33333333-3333-4333-8333-333333333333",
    videos: ["https://www.example.com/watch/tour"],
    media: {
      images: [`${PROJECT_ID}/3f2a9c1b-front-view.jpg`],
      floorPlans: [],
      elevations: [],
      plotImages: [],
      brochure: [`${PROJECT_ID}/0d0d0d0d-brochure.pdf`],
    },
    trends: [{ id: "a", month: "2026-10", price: "8350" }],
  };

  it("sends a new project's boxes, with the builder and the enquiry form for the admin, and no media", () => {
    const payload = payloadOf(state, { scope: "admin", projectId: null });
    expect(payload.name).toBe("Kadal Vista");
    expect(payload.builderId).toBe(project.builderId);
    expect(payload.formId).toBe(state.formId);
    expect("projectId" in payload).toBe(false);
    expect("images" in payload).toBe(false);
    expect("priceTrends" in payload).toBe(false);
  });

  it("sends a builder's new project without a builder or an enquiry form", () => {
    const payload = payloadOf(state, { scope: "builder", projectId: null });
    expect("builderId" in payload).toBe(false);
    expect("formId" in payload).toBe(false);
  });

  it("sends the admin's save with the media, the enquiry form and the price trends, and not the builder", () => {
    const payload = payloadOf(state, { scope: "admin", projectId: PROJECT_ID });
    expect(payload.projectId).toBe(PROJECT_ID);
    expect("builderId" in payload).toBe(false);
    expect(payload.formId).toBe(state.formId);
    expect(payload.images).toEqual([`${PROJECT_ID}/3f2a9c1b-front-view.jpg`]);
    expect(payload.brochure).toBe(`${PROJECT_ID}/0d0d0d0d-brochure.pdf`);
    expect(payload.videos).toEqual(["https://www.example.com/watch/tour"]);
    expect(payload.priceTrends).toEqual([{ month: "2026-10", pricePerSqft: "8350" }]);
  });

  it("sends a builder's save with the media only, and an empty brochure as none", () => {
    const payload = payloadOf(
      { ...state, media: { ...state.media, brochure: [] } },
      { scope: "builder", projectId: PROJECT_ID },
    );
    expect(payload.brochure).toBeNull();
    expect("formId" in payload).toBe(false);
    expect("priceTrends" in payload).toBe(false);
    expect(payload.images).toEqual([`${PROJECT_ID}/3f2a9c1b-front-view.jpg`]);
  });
});

const complete = (overrides: Partial<ProjectFieldValues> = {}): ProjectFieldValues => ({
  ...EMPTY_PROJECT_VALUES,
  name: "Kadal Vista",
  projectType: "residential",
  propertyType: "apartment",
  projectStatus: "ready_to_move",
  price: "78,00,000",
  priceType: "basic",
  locality: "Navalur",
  reraNotApplicableReason: "Below the size that needs registration.",
  ...overrides,
});

describe("UT-project-form-applies: which boxes the kind of project asks for (ADR-148)", () => {
  it.each([
    [
      { projectType: "residential", propertyType: "apartment", projectStatus: "ready_to_move" },
      {
        offerType: false,
        plotStatus: false,
        villaType: false,
        bedrooms: true,
        area: false,
        possession: false,
      },
    ],
    [
      { projectType: "residential", propertyType: "villa", projectStatus: "new_launch" },
      {
        offerType: false,
        plotStatus: false,
        villaType: true,
        bedrooms: true,
        area: false,
        possession: true,
      },
    ],
    [
      { projectType: "residential", propertyType: "plot", projectStatus: "under_construction" },
      {
        offerType: false,
        plotStatus: true,
        villaType: false,
        bedrooms: false,
        area: true,
        possession: true,
      },
    ],
    [
      { projectType: "commercial", propertyType: "office", projectStatus: "ready_to_move" },
      {
        offerType: true,
        plotStatus: false,
        villaType: false,
        bedrooms: false,
        area: true,
        possession: false,
      },
    ],
    [
      { projectType: "commercial", propertyType: "villa", projectStatus: "new_launch" },
      {
        offerType: true,
        plotStatus: false,
        villaType: true,
        bedrooms: false,
        area: true,
        possession: true,
      },
    ],
    [
      { projectType: "", propertyType: "", projectStatus: "" },
      {
        offerType: false,
        plotStatus: false,
        villaType: false,
        bedrooms: false,
        area: false,
        possession: false,
      },
    ],
  ])("%j asks for %j", (chosen, expected) => {
    expect(appliesOf(complete(chosen))).toEqual(expected);
  });
});

describe("UT-project-form-reconcile: what a choice clears (ADR-148)", () => {
  it("clears the bedrooms and asks for an area when a project becomes a plot", () => {
    const next = reconcile(complete({ propertyType: "plot", bhkOptions: [2, 3], areaMinSqft: "" }));
    expect(next.bhkOptions).toEqual([]);
    expect(next.propertyType).toBe("plot");
  });

  it("clears the area range when a plot becomes an apartment", () => {
    const next = reconcile(complete({ areaMinSqft: "1200", areaMaxSqft: "2400" }));
    expect(next.areaMinSqft).toBe("");
    expect(next.areaMaxSqft).toBe("");
  });

  it("drops a property type that does not fit the project type, and the sale or rent choice of a residential project", () => {
    const next = reconcile(
      complete({
        projectType: "commercial",
        propertyType: "apartment",
        offerType: "rent",
        priceType: "rent_per_month",
      }),
    );
    expect(next.propertyType).toBe("");
    expect(next.offerType).toBe("rent");
    expect(next.priceType).toBe("rent_per_month");
    const back = reconcile({ ...next, projectType: "residential" });
    expect(back.offerType).toBe("");
    expect(back.priceType).toBe("");
  });

  it("drops the price type when sale becomes rent and the other way round", () => {
    const sale = complete({
      projectType: "commercial",
      propertyType: "office",
      offerType: "sale",
      priceType: "all_inclusive",
      areaMinSqft: "500",
      areaMaxSqft: "900",
    });
    expect(reconcile(sale).priceType).toBe("all_inclusive");
    expect(reconcile({ ...sale, offerType: "rent" }).priceType).toBe("");
    const rent = { ...sale, offerType: "rent", priceType: "rent_per_month" };
    expect(reconcile(rent).priceType).toBe("rent_per_month");
    expect(reconcile({ ...rent, offerType: "sale" }).priceType).toBe("");
  });

  it("clears the possession month when the project is ready to move", () => {
    const next = reconcile(complete({ projectStatus: "ready_to_move", possessionDate: "2028-12" }));
    expect(next.possessionDate).toBe("");
    expect(
      reconcile(complete({ projectStatus: "new_launch", possessionDate: "2028-12" }))
        .possessionDate,
    ).toBe("2028-12");
  });

  it("leaves a complete, consistent form as it is", () => {
    const values = complete();
    expect(reconcile(values)).toEqual(values);
  });
});

describe("UT-project-form-problems: what is missing before a save is sent (ADR-148)", () => {
  const found = (overrides: Partial<ProjectFieldValues> = {}, needsBuilder = false) =>
    projectProblems(complete(overrides), { needsBuilder });

  it("finds nothing wrong with a complete project", () => {
    expect(found()).toEqual({});
  });

  it("names every missing required box at once", () => {
    expect(projectProblems(EMPTY_PROJECT_VALUES, { needsBuilder: true })).toEqual({
      name: "name",
      builderId: "builder",
      projectType: "projectType",
      propertyType: "propertyType",
      projectStatus: "status",
      price: "price",
      priceType: "priceType",
      reraNotApplicableReason: "reraReason",
      locality: "locality",
    });
  });

  it("needs the sale or rent choice for a commercial project only", () => {
    const commercial = {
      projectType: "commercial",
      propertyType: "office",
      areaMinSqft: "500",
      areaMaxSqft: "900",
    };
    expect(found(commercial).offerType).toBe("offerType");
    expect(found({ ...commercial, offerType: "sale" }).offerType).toBeUndefined();
    expect(found().offerType).toBeUndefined();
  });

  it("needs a price of at least 1, written the way the server reads it", () => {
    expect(found({ price: "" }).price).toBe("price");
    expect(found({ price: "0" }).price).toBe("price");
    expect(found({ price: "12.5" }).price).toBe("price");
    expect(found({ price: "lakhs" }).price).toBe("price");
    expect(found({ price: "1,480" }).price).toBeUndefined();
  });

  it("needs the area range for a plot and a commercial project, with the smallest not above the largest", () => {
    const plot = { propertyType: "plot", plotStatus: "investment" };
    expect(found(plot)).toMatchObject({ areaMinSqft: "area", areaMaxSqft: "area" });
    expect(found({ ...plot, areaMinSqft: "2400", areaMaxSqft: "1200" })).toEqual({
      areaMaxSqft: "areaRange",
    });
    expect(found({ ...plot, areaMinSqft: "1,200", areaMaxSqft: "1200" })).toEqual({});
    expect(found({ ...plot, areaMinSqft: "0", areaMaxSqft: "1200" }).areaMinSqft).toBe("area");
    expect(found().areaMinSqft).toBeUndefined();
  });

  it("needs the plot status for a plot and the villa type for a villa only (ADR-160)", () => {
    expect(found({ propertyType: "plot" }).plotStatus).toBe("plotStatus");
    expect(found({ propertyType: "plot", plotStatus: "investment" }).plotStatus).toBeUndefined();
    expect(found({ propertyType: "villa" }).villaType).toBe("villaType");
    expect(found({ propertyType: "villa", villaType: "duplex" }).villaType).toBeUndefined();
    expect(found({ projectType: "commercial", propertyType: "villa" }).villaType).toBe("villaType");
    expect(found().plotStatus).toBeUndefined();
    expect(found().villaType).toBeUndefined();
  });

  it("clears the plot status and the villa type when the property type changes (ADR-160)", () => {
    const base = complete({
      propertyType: "plot",
      plotStatus: "investment",
      areaMinSqft: "1",
      areaMaxSqft: "2",
    });
    expect(reconcile(base).plotStatus).toBe("investment");
    expect(reconcile({ ...base, propertyType: "villa" }).plotStatus).toBe("");
    const villa = complete({ propertyType: "villa", villaType: "duplex" });
    expect(reconcile(villa).villaType).toBe("duplex");
    expect(reconcile({ ...villa, propertyType: "apartment" }).villaType).toBe("");
  });

  it("needs the possession month while the project is still to be built, and not for a ready one", () => {
    expect(found({ projectStatus: "new_launch" }).possessionDate).toBe("possession");
    expect(
      found({ projectStatus: "under_construction", possessionDate: "2028-12" }).possessionDate,
    ).toBeUndefined();
    expect(found({ projectStatus: "ready_to_move" }).possessionDate).toBeUndefined();
  });

  it("needs the RERA number when RERA applies and the reason when it does not", () => {
    expect(found({ reraApplicable: true })).toEqual({ reraNumber: "reraNumber" });
    expect(found({ reraApplicable: true, reraNumber: "TN/1" })).toEqual({});
    expect(found({ reraApplicable: false, reraNotApplicableReason: "  " })).toEqual({
      reraNotApplicableReason: "reraReason",
    });
  });
});
