import { describe, expect, it } from "vitest";
import type { ProjectFieldValues } from "@/components/domain/project-fields";
import {
  EMPTY_PROJECT_VALUES,
  displayNameOf,
  errorFieldOf,
  fileProblem,
  itemOfPath,
  mediaOf,
  payloadOf,
  publicMediaUrl,
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
  projectStatus: "under_construction",
  priceMin: 7800000,
  priceMax: 14200000,
  bhkOptions: [2, 3],
  landAreaAcres: 4.2,
  totalUnits: null,
  possessionDate: "2028-12-31",
  contactPhone: null,
  locality: "OMR Navalur",
  address: null,
  latitude: 12.8451,
  longitude: 80.2262,
  advantages: ["Near the beach road"],
  nearby: [],
  reraApplicable: true,
  reraNumber: "TN/SAMPLE/0000",
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
    expect(values.priceMin).toBe("7800000");
    expect(values.landAreaAcres).toBe("4.2");
    expect(values.latitude).toBe("12.8451");
    expect(values.propertyType).toBe("");
    expect(values.totalUnits).toBe("");
    expect(values.address).toBe("");
    expect(values.possessionDate).toBe("2028-12-31");
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
    expect(sectionOfError("priceMax")).toBe("basics");
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
