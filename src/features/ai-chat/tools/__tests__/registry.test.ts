import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ASSISTANT_BRAND_NAME, MAX_TOOL_RESULT_ITEMS } from "@/config/ai";
import type { ListingRow } from "@/features/search";
import {
  injected,
  keysIn,
  listingRow,
  projectData,
  projectListItem,
  projectUnit,
  propertyData,
  READ_AT,
  stringsIn,
  TOOL_CONTEXT,
} from "./fixtures";

// UT-ai-tools-registry (ADR-128 sections 4.1 principle 5, 4.4 rule 1, 5.4, 6.4.3 and 9). These tests walk
// EVERY registered tool, so a tool added later is held to the same rules without anyone remembering to:
//  - no tool input names a person (a user id, a phone, an email, an owner, or similar);
//  - every tool input stays inside the portable schema subset;
//  - no tool result carries an owner, a phone, an email, an address or an exact location;
//  - third-party text sits only under `untrustedText`;
//  - no result holds more than ten items.
// The reads are stand-ins; the people, homes and places are made up.

const getSearchResults = vi.fn();
const getProperty = vi.fn();
const getLocalityCounts = vi.fn();
const getBuilderDirectory = vi.fn();
const getBuilderProfile = vi.fn();
const getProjects = vi.fn();
const getProject = vi.fn();
const getComparedHomes = vi.fn();
const getSessionView = vi.fn();
const ownsHome = vi.fn();
const searchContent = vi.fn();
const readContentItem = vi.fn();
const searchJobs = vi.fn();

vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
// The propose tools sign with the secret the rate limiter holds, and read who is asking from the session.
vi.mock(import("@/server/env"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    env: { ...actual.env, RATE_LIMIT_HMAC_SECRET: "a-made-up-secret-of-thirty-two-chars!" },
  };
});
vi.mock("@/server/auth/get-session-view", () => ({ getSessionView }));
vi.mock("@/features/search", async () => {
  const { DEFAULT_RADIUS_KM, DEFAULT_SORT, DEFAULT_VIEW } =
    await import("@/features/search/schemas");
  const { NEARBY_RADIUS_KM, nearbyHomesToShow, nearbySearchParams, wantsNearby } =
    await import("@/features/search/nearby");
  return {
    getSearchResults,
    DEFAULT_RADIUS_KM,
    DEFAULT_SORT,
    DEFAULT_VIEW,
    NEARBY_RADIUS_KM,
    nearbyHomesToShow,
    nearbySearchParams,
    wantsNearby,
  };
});
vi.mock("@/features/property", async () => {
  const { amenityList, perSqftRupees } = await import("@/features/property/view");
  return { getProperty, amenityList, perSqftRupees };
});
vi.mock("@/features/projects", async () => {
  const { bhkSizes, priceOf, TREND_MONTHS } = await import("@/features/projects/view");
  const { isProjectSlug } = await import("@/features/projects/address");
  const { OFFER_TYPES, PRICE_TYPES, PROJECT_STATUSES } =
    await import("@/features/projects/schemas");
  const { visitDateProblem } = await import("@/features/projects/lead-view");
  return {
    getProjects,
    getProject,
    bhkSizes,
    priceOf,
    TREND_MONTHS,
    isProjectSlug,
    visitDateProblem,
    OFFER_TYPES,
    PRICE_TYPES,
    PROJECT_STATUSES,
    PROJECT_LIST_LIMIT: 60,
  };
});
vi.mock("@/features/compare", async () => {
  const { COMPARE_MAX, COMPARE_MIN } = await import("@/features/compare/store");
  return { getComparedHomes, COMPARE_MAX, COMPARE_MIN };
});
vi.mock("../../queries", () => ({
  getLocalityCounts,
  getBuilderDirectory,
  getBuilderProfile,
  ownsHome,
}));
// The job tools take the work modes and types from the Careers feature (ADR-143 section 6).
vi.mock("@/features/careers", async () => {
  const { EMPLOYMENT_TYPES, WORK_MODES } = await import("@/features/careers/constants");
  return { EMPLOYMENT_TYPES, WORK_MODES };
});
// The content tools read the Blog, the FAQ and Careers through this one module (ADR-143 section 6).
vi.mock("../../content-queries", () => ({ searchContent, readContentItem, searchJobs }));
// The index also exports the chat page's screen; this test is about the tools, so the screen is a stand-in.
vi.mock("../../ask-about-button", () => ({ AskAboutButton: () => null }));
vi.mock("../../chat-screen", () => ({
  AiChatScreen: () => null,
  AiChatScreenSkeleton: () => null,
}));

const { AI_CHAT_TOOLS, runTool, toolDefinitions, UNTRUSTED_TEXT_KEY } =
  await import("@/features/ai-chat");
const { createAiChatTools } = await import("../registry");
const { searchPropertiesTool } = await import("../search-properties");
const { findPortableSchemaViolations, PortableSchemaError } = await import("@/server/ai");

// ---------------------------------------------------------------- the checkers

/** The words of a field name: `ownerPhone`, `owner_phone` and `OwnerPhone2` are owner, phone (and 2). */
function wordsOf(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== "");
}

/** Words that say a field is, or identifies, a person. No tool may take one (ADR-128 section 6.4.3). */
const PERSON_WORDS = new Set([
  "user",
  "users",
  "owner",
  "owners",
  "customer",
  "customers",
  "person",
  "people",
  "profile",
  "profiles",
  "account",
  "accounts",
  "member",
  "members",
  "buyer",
  "seller",
  "tenant",
  "landlord",
  "lister",
  "agent",
  "visitor",
  "caller",
  "enquirer",
  "phone",
  "mobile",
  "whatsapp",
  "email",
  "mail",
  "contact",
  "aadhaar",
  "pan",
  "passport",
  "uid",
  "session",
  "token",
  "password",
  "otp",
]);
/** The same, for names written as one word (`userid`, `phonenumber`). */
const PERSON_STEMS = ["userid", "ownerid", "customerid", "phone", "email", "mobile"];

function namesAPerson(field: string): boolean {
  const joined = field.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    wordsOf(field).some((word) => PERSON_WORDS.has(word)) ||
    PERSON_STEMS.some((stem) => joined.includes(stem))
  );
}

/** Words no key of a tool result may hold: who owns a home, how to reach them, and where exactly it is. */
const PRIVATE_RESULT_WORDS = new Set([
  "owner",
  "owners",
  "user",
  "phone",
  "mobile",
  "email",
  "address",
  "location",
  "latitude",
  "longitude",
  "coordinates",
  "point",
  "pincode",
  "moderation",
  "rejection",
]);

function isPrivateKey(key: string): boolean {
  return wordsOf(key).some((word) => PRIVATE_RESULT_WORDS.has(word));
}

/**
 * The one deliberate exception to "no phone in a tool result" (ADR-128 section 6.4.3, point 4): a project's
 * public contact phone, which the project page shows and `get_project` returns under exactly this key, and
 * only in the shape of a phone number (`public-contacts.ts`). It is named by tool and key, so it opens no
 * other tool and no other field. A builder's website is not on the private list, so it needs no exception.
 */
const NAMED_EXCEPTIONS: readonly { tool: string; key: string }[] = [
  { tool: "get_project", key: "contactPhone" },
];

/** Whether a key of this tool's result is private, after the named exceptions. */
function isPrivateKeyOf(tool: string, key: string): boolean {
  return (
    isPrivateKey(key) &&
    !NAMED_EXCEPTIONS.some((exception) => exception.tool === tool && exception.key === key)
  );
}

/** Every property name anywhere in a JSON Schema, with where it is. */
function propertyNamesIn(schema: unknown, location = "$"): { name: string; location: string }[] {
  if (Array.isArray(schema)) {
    return schema.flatMap((item, index) => propertyNamesIn(item, `${location}[${index}]`));
  }
  if (typeof schema !== "object" || schema === null) return [];
  return Object.entries(schema).flatMap(([key, value]) => {
    if (key === "properties" && typeof value === "object" && value !== null) {
      return Object.entries(value).flatMap(([name, child]) => [
        { name, location: `${location}.${name}` },
        ...propertyNamesIn(child, `${location}.${name}`),
      ]);
    }
    return propertyNamesIn(value, location);
  });
}

// ---------------------------------------------------------------- one valid call for every tool

/** A visit day inside the window whatever day the tests run: a month from today, India time. */
const { addDays, indiaToday } = await import("@/features/projects/lead-view");
const VISIT_DAY = addDays(indiaToday(new Date()), 30);

/** The id of the made-up article every content stand-in below returns. */
const CONTENT_ID = "a1000000-0000-4000-8000-000000000001";

/**
 * An input each tool accepts. A tool added to the registry must be added here too (a test below fails
 * otherwise), which is what puts it through every result check in this file.
 */
const VALID_INPUTS: Record<string, unknown> = {
  search_properties: {
    listingType: null,
    propertyType: null,
    bhk: null,
    minPrice: null,
    maxPrice: null,
    locality: null,
    keyword: null,
    label: null,
    sort: null,
    limit: null,
  },
  get_property: { homeId: "k3x9a2bd" },
  list_localities: { search: null },
  search_projects: { locality: null, status: null, bhk: null, maxPrice: null, limit: null },
  get_project: { slug: "kadal-vista" },
  get_builder: { builderId: null, name: "Kadal Homes" },
  compare_properties: { homeIds: ["k3x9a2bd", "m4y8b3ce", "n5z7c4dh"] },
  calculate_emi: {
    mode: "emi",
    priceRupees: 12_500_000,
    loanAmountRupees: null,
    monthlyBudgetRupees: null,
    downPaymentPercent: null,
    annualRatePercent: null,
    years: null,
  },
  search_content: { query: "registration charges", kind: "any", category: null, limit: null },
  search_jobs: {
    query: "site engineer",
    department: null,
    location: null,
    workMode: null,
    type: null,
    limit: null,
  },
  get_content_item: { id: CONTENT_ID, query: "registration charges" },
  propose_enquiry: { homeId: "k3x9a2bd", message: "Is this home still available?" },
  propose_site_visit: {
    slug: "kadal-vista",
    visitDate: VISIT_DAY,
    message: "I would like to see the show flat.",
  },
};

/** What a read must never hand to the model, planted in every stand-in read to prove it does not get through. */
const PRIVATE = {
  owner_id: "made-up-owner-7f3a",
  ownerName: "Made-up Owner Name",
  phone: "made-up-phone-0000",
  email: "made-up-owner@example.test",
  address: "12 Made-up Private Lane",
  location: "POINT(80.270741 13.082741)",
  latitude: 13.082741,
  longitude: 80.270741,
};

const callEveryTool = () =>
  Promise.all(
    AI_CHAT_TOOLS.map(async (tool) => ({
      name: tool.name,
      outcome: await runTool(
        AI_CHAT_TOOLS,
        { name: tool.name, input: VALID_INPUTS[tool.name] },
        TOOL_CONTEXT,
      ),
    })),
  );

beforeEach(() => {
  vi.clearAllMocks();
  // A signed-in customer who owns none of the homes, for the propose tools.
  getSessionView.mockResolvedValue({
    userId: "11111111-1111-4111-8111-111111111111",
    roles: ["customer"],
    phoneVerified: true,
    builderId: null,
  });
  ownsHome.mockResolvedValue(false);
  // Fifteen homes and twenty-five localities, more than a result may hold, each carrying private fields a
  // read does not give today and third-party text in every field a lister can type.
  const homes = Array.from("abcdefghjkmnpqr", (letter) => ({
    ...listingRow({
      short_id: letter.repeat(8),
      title: injected("title"),
      locality: injected("locality"),
      city: injected("city"),
    }),
    ...PRIVATE,
  })) as ListingRow[];
  getSearchResults.mockResolvedValue({ status: "ok", homes, total: 240, readAt: READ_AT });
  getProperty.mockResolvedValue({
    status: "found",
    readAt: READ_AT,
    property: {
      ...propertyData({
        title: injected("title"),
        description: injected("description"),
        amenities: [injected("amenity")],
        locality: injected("locality"),
        city: injected("city"),
      }),
      ...PRIVATE,
    },
  });
  getComparedHomes.mockResolvedValue({
    properties: ["k3x9a2bd", "m4y8b3ce", "n5z7c4dh"].map((shortId, index) => ({
      ...propertyData({
        shortId,
        slug: `home-${index}`,
        price: 12_500_000 + index * 1_000_000,
        title: injected("title"),
        amenities: [injected("amenity")],
        locality: injected("locality"),
        city: injected("city"),
      }),
      ...PRIVATE,
    })),
    readAt: READ_AT,
  });
  getLocalityCounts.mockResolvedValue({
    localities: Array.from({ length: 25 }, (_, index) => ({
      name: `${injected("locality")} ${index}`,
      homes: 25 - index,
      projects: 1,
      ...PRIVATE,
    })),
    complete: true,
    readAt: READ_AT,
  });
  // Twenty-five projects, a project with twelve BHK sizes of units, and a builder with fifteen live projects,
  // each with third-party text in every field a developer can type, and private fields a read does not give.
  getProjects.mockResolvedValue({
    status: "ok",
    projects: Array.from({ length: 25 }, (_, index) => ({
      ...projectListItem({
        slug: `project-${index}`,
        name: injected("project"),
        developerName: injected("developer"),
        locality: injected("locality"),
      }),
      ...PRIVATE,
    })),
    readAt: READ_AT,
  });
  getProject.mockResolvedValue({
    status: "found",
    readAt: READ_AT,
    project: {
      ...projectData({
        name: injected("project"),
        description: injected("description"),
        amenities: [injected("amenity")],
        nearby: [injected("nearby")],
        reraNumber: injected("rera"),
        locality: injected("locality"),
        developer: { id: "0b6f9c2e-3d41-4a8e-9f07-2c5d8e1a7b34", name: injected("developer") },
        units: Array.from({ length: 12 }, (_, index) =>
          projectUnit({ number: `U-${index}`, bhk: index + 1 }),
        ),
        unitCount: 12,
        availableCount: 12,
      }),
      ...PRIVATE,
    },
  });
  getBuilderDirectory.mockResolvedValue({
    builders: [{ id: "0b6f9c2e-3d41-4a8e-9f07-2c5d8e1a7b34", name: "Kadal Homes", ...PRIVATE }],
    readAt: READ_AT,
  });
  // Seven hits, more than a result may hold, and an article of three long sections, each with third-party text in
  // every field an admin can type and private fields a read does not give.
  searchContent.mockResolvedValue(
    Array.from({ length: 7 }, (_, index) => ({
      kind: index % 2 === 0 ? "article" : "faq",
      id: `a100000${index}-0000-4000-8000-00000000000${index}`,
      slug: index % 2 === 0 ? `guide-${index}` : null,
      title: injected("title"),
      categoryName: injected("category"),
      categorySlug: "buying-guide",
      date: "2026-11-05T08:00:00.000Z",
      passage: injected("passage"),
      ...PRIVATE,
    })),
  );
  // Seven open jobs, more than a result may hold, with third-party text in every field an admin can type.
  searchJobs.mockResolvedValue(
    Array.from({ length: 7 }, (_, index) => ({
      ...PRIVATE,
      id: `b200000${index}-0000-4000-8000-00000000000${index}`,
      slug: `site-engineer-${index}`,
      title: injected("title"),
      departmentName: injected("department"),
      departmentSlug: "engineering",
      location: injected("location"),
      workMode: "hybrid",
      employmentType: "full_time",
      experience: injected("experience"),
      salaryNote: injected("pay"),
      closesAt: "2026-12-31T12:30:00.000Z",
      passage: injected("passage"),
    })),
  );
  readContentItem.mockResolvedValue({
    kind: "article",
    id: CONTENT_ID,
    slug: "registration-charges",
    title: injected("title"),
    categoryName: injected("category"),
    date: "2026-11-05T08:00:00.000Z",
    sections: Array.from({ length: 3 }, (_, index) => injected(`section ${index}`).repeat(60)),
    ...PRIVATE,
  });
  getBuilderProfile.mockResolvedValue({
    status: "found",
    readAt: READ_AT,
    builder: {
      id: "0b6f9c2e-3d41-4a8e-9f07-2c5d8e1a7b34",
      name: injected("builder"),
      website: "https://kadalhomes.example.test/",
      description: injected("description"),
      ...PRIVATE,
    },
    projects: Array.from({ length: 15 }, (_, index) => ({
      slug: `kadal-${index}`,
      name: injected("project"),
      status: "under_construction",
      locality: injected("locality"),
      possessionDate: "2028-12-31",
      reraApplicable: true,
      reraNumber: injected("rera"),
      ...PRIVATE,
    })),
    projectCount: 15,
    firstProjectAt: "2026-03-14",
  });
});

// ---------------------------------------------------------------- the tests

describe("UT-ai-tools-registry: the list", () => {
  it("holds the eleven read tools and the two propose tools", () => {
    const names = AI_CHAT_TOOLS.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "search_properties",
        "get_property",
        "list_localities",
        "search_projects",
        "get_project",
        "get_builder",
        "compare_properties",
        "calculate_emi",
        "search_content",
        "search_jobs",
        "get_content_item",
        "propose_enquiry",
        "propose_site_visit",
      ]),
    );
    expect(names).toHaveLength(13);
  });

  it("serves the search tool that has always existed while place search is off, and the place-aware one only with a lookup (ADR-142)", () => {
    const names = AI_CHAT_TOOLS.map((tool) => tool.name);
    expect(AI_CHAT_TOOLS.find((tool) => tool.name === "search_properties")).toBe(
      searchPropertiesTool,
    );
    const lookup = vi.fn();
    const withPlaces = createAiChatTools(lookup);
    expect(withPlaces.map((tool) => tool.name)).toEqual(names);
    const [search] = withPlaces;
    expect(search).not.toBe(searchPropertiesTool);
    const shape = (search?.input as { shape?: Record<string, unknown> }).shape ?? {};
    expect(Object.keys(shape)).toEqual(expect.arrayContaining(["place", "radiusKm"]));
    const oldShape =
      (searchPropertiesTool.input as { shape?: Record<string, unknown> }).shape ?? {};
    expect(Object.keys(oldShape)).not.toContain("place");
    // The same twelve tools, every other one untouched.
    expect(withPlaces.slice(1)).toEqual(AI_CHAT_TOOLS.slice(1));
  });

  it("gives every tool a kind: eleven read tools the loop may run in parallel, and two propose tools that run alone", () => {
    for (const tool of AI_CHAT_TOOLS) expect(["read", "propose"], tool.name).toContain(tool.kind);
    expect(AI_CHAT_TOOLS.map((tool) => tool.kind)).toEqual([
      ...Array<string>(11).fill("read"),
      "propose",
      "propose",
    ]);
  });

  it("gives every tool its own name, in the form a provider accepts", () => {
    const names = AI_CHAT_TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9_]{0,63}$/);
  });

  it("has a valid call for every tool in this file, so every tool goes through the checks below", () => {
    expect(Object.keys(VALID_INPUTS).sort()).toEqual(AI_CHAT_TOOLS.map((tool) => tool.name).sort());
  });

  it("describes every tool and every input field for the model", () => {
    for (const definition of toolDefinitions(AI_CHAT_TOOLS)) {
      expect(definition.description.length, definition.name).toBeGreaterThan(40);
      const fields = (definition.parameters.properties ?? {}) as Record<
        string,
        { description?: string }
      >;
      for (const [field, schema] of Object.entries(fields)) {
        expect(schema.description, `${definition.name}.${field}`).toEqual(expect.any(String));
      }
    }
  });

  it("calls the product findsprop, in lowercase, wherever a description names it (ADR-128 D11)", () => {
    expect(ASSISTANT_BRAND_NAME).toBe("findsprop");
    for (const tool of AI_CHAT_TOOLS) {
      const withoutName = tool.description.replaceAll(ASSISTANT_BRAND_NAME, "");
      expect(withoutName, tool.name).not.toMatch(/finds?\s*prop/i);
    }
  });
});

describe("UT-ai-tools-registry: no tool takes a person as input (ADR-128 section 6.4.3)", () => {
  it("finds no field that names a user, an owner, a phone, an email or similar", () => {
    for (const definition of toolDefinitions(AI_CHAT_TOOLS)) {
      const fields = propertyNamesIn(definition.parameters);
      expect(fields.length, definition.name).toBeGreaterThan(0);
      const people = fields.filter(({ name }) => namesAPerson(name));
      expect(people, `${definition.name} takes a person as input`).toEqual([]);
    }
  });

  it("the checker itself catches a person, however the field is written or nested", () => {
    const takesPeople = z.object({
      userId: z.string(),
      owner_phone: z.string(),
      EMAIL: z.string().nullable(),
      filters: z.object({ contactNumber: z.string() }),
      people: z.array(z.object({ customerName: z.string() })),
      mobilenumber: z.string(),
      homeId: z.string(),
      locality: z.string(),
      ownerless: z.boolean(),
    });
    const [definition] = toolDefinitions([
      {
        name: "made_up_lookup",
        kind: "read",
        description: "A made-up tool that exists only in this test.",
        input: takesPeople,
        output: z.object({}),
        run: async () => ({ output: {}, references: [] }),
      },
    ]);
    const flagged = propertyNamesIn(definition?.parameters)
      .filter(({ name }) => namesAPerson(name))
      .map(({ location }) => location);
    expect(flagged).toEqual([
      "$.userId",
      "$.owner_phone",
      "$.EMAIL",
      "$.filters.contactNumber",
      "$.people",
      "$.people.customerName",
      "$.mobilenumber",
    ]);
  });

  it("gives a tool nothing that names a person when it runs: only the words and the language", () => {
    expect(Object.keys(TOOL_CONTEXT).sort()).toEqual(["locale", "translate"]);
  });
});

describe("UT-ai-tools-registry: every input stays inside the portable subset (ADR-128 section 4.4, rule 1)", () => {
  it("builds a definition for every tool, with no violation", () => {
    const definitions = toolDefinitions(AI_CHAT_TOOLS);
    expect(definitions).toHaveLength(AI_CHAT_TOOLS.length);
    for (const definition of definitions) {
      expect(findPortableSchemaViolations(definition.parameters), definition.name).toEqual([]);
    }
  });

  it("the check itself fails for a tool that leaves the subset", () => {
    const [first] = AI_CHAT_TOOLS;
    if (first === undefined) throw new Error("the registry is empty");
    const outside = [
      z.object({ locality: z.string().optional() }),
      z.object({ price: z.union([z.string(), z.number()]) }),
      z.object({ limit: z.int().min(1).max(10) }),
      z.object({ sort: z.string().default("newest") }),
    ];
    for (const input of outside) {
      expect(() =>
        toolDefinitions([...AI_CHAT_TOOLS, { ...first, name: "made_up", input }]),
      ).toThrow(PortableSchemaError);
    }
  });
});

describe("UT-ai-tools-registry: no result names an owner or anything private (ADR-128 section 6.4.3)", () => {
  it("has no private field in any tool's output schema", () => {
    for (const tool of AI_CHAT_TOOLS) {
      const fields = propertyNamesIn(z.toJSONSchema(tool.output, { io: "output" }));
      expect(fields.length, tool.name).toBeGreaterThan(0);
      expect(
        fields.filter(({ name }) => isPrivateKeyOf(tool.name, name)),
        `${tool.name} can return a private field`,
      ).toEqual([]);
    }
  });

  it("drops a private field a read hands over, before the model sees the result", async () => {
    for (const { name, outcome } of await callEveryTool()) {
      expect(outcome.status, name).toBe("ok");
      const output = outcome.status === "ok" ? outcome.output : null;
      expect(
        keysIn(output).filter((key) => isPrivateKeyOf(name, key)),
        name,
      ).toEqual([]);
      for (const value of Object.values(PRIVATE)) {
        expect(outcome.content, name).not.toContain(String(value));
      }
    }
  });

  it("allows exactly one phone, the project contact phone of get_project, and no other private key", async () => {
    expect(NAMED_EXCEPTIONS).toEqual([{ tool: "get_project", key: "contactPhone" }]);
    const withPhone = [];
    for (const tool of AI_CHAT_TOOLS) {
      const keys = propertyNamesIn(z.toJSONSchema(tool.output, { io: "output" })).map(
        ({ name }) => name,
      );
      for (const key of keys) if (isPrivateKey(key)) withPhone.push(`${tool.name}.${key}`);
    }
    expect(withPhone).toEqual(["get_project.contactPhone"]);
    // The phone a read hands over under any other name still does not get through.
    for (const { name, outcome } of await callEveryTool()) {
      expect(outcome.content, name).not.toContain(PRIVATE.phone);
    }
    // The one phone is the project's own, in the shape of a phone number, and in no other tool's result.
    for (const { name, outcome } of await callEveryTool()) {
      const phones = stringsIn(outcome.status === "ok" ? outcome.output : null).filter(({ text }) =>
        /^\+?[0-9]{6,15}$/.test(text),
      );
      expect(
        phones.map(({ path }) => path.join(".")),
        name,
      ).toEqual(name === "get_project" ? ["project.contactPhone"] : []);
    }
  });

  it("the checker itself catches an owner, a contact and an exact place", () => {
    const leaky = z.object({
      homes: z.array(
        z.object({ homeId: z.string(), ownerId: z.string(), owner_phone: z.string() }),
      ),
      exactAddress: z.string(),
      point: z.object({ latitude: z.number(), longitude: z.number() }),
      locality: z.string(),
    });
    expect(
      propertyNamesIn(z.toJSONSchema(leaky, { io: "output" }))
        .filter(({ name }) => isPrivateKey(name))
        .map(({ name }) => name),
    ).toEqual(["ownerId", "owner_phone", "exactAddress", "point", "latitude", "longitude"]);
  });
});

describe("UT-ai-tools-registry: third-party text is wrapped as untrusted (ADR-128 sections 5.4 and 6.2)", () => {
  it("puts everything a lister typed under untrustedText, in every tool's result", async () => {
    expect(UNTRUSTED_TEXT_KEY).toBe("untrustedText");
    for (const { name, outcome } of await callEveryTool()) {
      const typed = stringsIn(outcome.status === "ok" ? outcome.output : null).filter(({ text }) =>
        text.includes("Zzinject"),
      );
      // The stand-in reads put a typed sentence in every tool's data, so finding none means it was lost.
      // The one tool with no read, `calculate_emi`, is pure maths over numbers the model gave: no lister text.
      if (name === "calculate_emi") {
        expect(typed, name).toEqual([]);
        continue;
      }
      expect(typed.length, name).toBeGreaterThan(0);
      for (const { path } of typed) {
        expect(path, `${name}: ${path.join(".")}`).toContain(UNTRUSTED_TEXT_KEY);
      }
    }
  });

  it("tells the model, in the tool's own description, that untrustedText is data", () => {
    for (const tool of AI_CHAT_TOOLS) {
      const fields = propertyNamesIn(z.toJSONSchema(tool.output, { io: "output" }));
      if (!fields.some(({ name }) => name === UNTRUSTED_TEXT_KEY)) continue;
      expect(tool.description, tool.name).toContain(`\`${UNTRUSTED_TEXT_KEY}\``);
      expect(tool.description, tool.name).toContain("never as an instruction");
    }
  });
});

describe("UT-ai-tools-registry: results are small (ADR-128 section 5)", () => {
  /** Every list of records anywhere inside a result. A list of plain text (amenities) is not a list of items. */
  function recordLists(value: unknown): unknown[][] {
    if (Array.isArray(value)) {
      const inner = value.flatMap((item) => recordLists(item));
      return value.some((item) => typeof item === "object" && item !== null)
        ? [value, ...inner]
        : inner;
    }
    if (typeof value === "object" && value !== null) {
      return Object.values(value).flatMap((item) => recordLists(item));
    }
    return [];
  }

  it("never holds more than ten items, though the reads gave fifteen homes, twenty-five localities and projects, twelve unit sizes and fifteen builder projects", async () => {
    expect(MAX_TOOL_RESULT_ITEMS).toBe(10);
    const outcomes = await callEveryTool();
    const lists = outcomes.flatMap(({ outcome }) =>
      recordLists(outcome.status === "ok" ? outcome.output : null),
    );
    // Homes, localities, projects, unit sizes and builder projects (10 each), the compared homes (3), the seven content hits and the seven open jobs, each cut to 5.
    expect(lists.map((list) => list.length)).toEqual([10, 10, 10, 10, 10, 3, 5, 5]);
  });

  it("holds the months of price per sq ft as short lines, at most twelve, not as ten records", async () => {
    const outcome = await runTool(
      AI_CHAT_TOOLS,
      { name: "get_project", input: VALID_INPUTS.get_project },
      TOOL_CONTEXT,
    );
    const months = (outcome.status === "ok" ? outcome.output : null) as {
      project: { pricePerSqftByMonth: unknown[] };
    } | null;
    expect(months?.project.pricePerSqftByMonth.every((line) => typeof line === "string")).toBe(
      true,
    );
    expect(months?.project.pricePerSqftByMonth.length).toBeLessThanOrEqual(12);
  });

  it("returns the id of every home and the slug of every project a result names, and of no other", async () => {
    for (const { name, outcome } of await callEveryTool()) {
      if (outcome.status !== "ok") throw new Error(`${name} did not run`);
      const content = name === "search_content" || name === "get_content_item";
      if (name === "search_jobs") {
        // A job is named by its address word, which the result does not show the model: one reference per item.
        const items = (outcome.output as { items: unknown[] }).items;
        expect(outcome.references.map(({ kind }) => kind)).toEqual(items.map(() => "job"));
        continue;
      }
      // A home is named by `homeId`, a project by `slug`, an article or a question by `id` (ADR-143 section 6.5).
      const named = stringsIn(outcome.output)
        .filter(({ path }) =>
          content ? path.at(-1) === "id" : path.at(-1) === "homeId" || path.at(-1) === "slug",
        )
        .map(({ text }) => text);
      expect(
        outcome.references.map((reference) => {
          switch (reference.kind) {
            case "home":
              return reference.homeId;
            case "project":
              return reference.slug;
            case "article":
            case "faq":
              return reference.id;
            case "job":
              return reference.slug;
          }
        }),
        name,
      ).toEqual(named);
    }
  });

  it("builds a project reference for the tools that name projects, a home reference for those that name homes, and a source reference for the content tools", async () => {
    const kinds = Object.fromEntries(
      (await callEveryTool()).map(({ name, outcome }) => [
        name,
        [...new Set(outcome.status === "ok" ? outcome.references.map(({ kind }) => kind) : [])],
      ]),
    );
    expect(kinds).toEqual({
      search_properties: ["home"],
      get_property: ["home"],
      list_localities: [],
      search_projects: ["project"],
      get_project: ["project"],
      get_builder: ["project"],
      compare_properties: ["home"],
      calculate_emi: [],
      search_content: ["article", "faq"],
      search_jobs: ["job"],
      get_content_item: ["article"],
      propose_enquiry: ["home"],
      propose_site_visit: ["project"],
    });
  });
});
