import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ASSISTANT_BRAND_NAME, MAX_TOOL_RESULT_ITEMS } from "@/config/ai";
import type { ListingRow } from "@/features/search";
import { injected, keysIn, listingRow, propertyData, stringsIn, TOOL_CONTEXT } from "./fixtures";

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

vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/features/search", async () => {
  const { DEFAULT_SORT, DEFAULT_VIEW } = await import("@/features/search/schemas");
  return { getSearchResults, DEFAULT_SORT, DEFAULT_VIEW };
});
vi.mock("@/features/property", async () => {
  const { amenityList, perSqftRupees } = await import("@/features/property/view");
  return { getProperty, amenityList, perSqftRupees };
});
vi.mock("../../queries", () => ({ getLocalityCounts }));

const { AI_CHAT_TOOLS, runTool, toolDefinitions, UNTRUSTED_TEXT_KEY } =
  await import("@/features/ai-chat");
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
  getSearchResults.mockResolvedValue({ status: "ok", homes, total: 240 });
  getProperty.mockResolvedValue({
    status: "found",
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
  getLocalityCounts.mockResolvedValue({
    localities: Array.from({ length: 25 }, (_, index) => ({
      name: `${injected("locality")} ${index}`,
      homes: 25 - index,
      projects: 1,
      ...PRIVATE,
    })),
    complete: true,
    readAt: "2026-11-13T10:12:00.000Z",
  });
});

// ---------------------------------------------------------------- the tests

describe("UT-ai-tools-registry: the list", () => {
  it("holds the three read tools of this task", () => {
    const names = AI_CHAT_TOOLS.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining(["search_properties", "get_property", "list_localities"]),
    );
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
        fields.filter(({ name }) => isPrivateKey(name)),
        `${tool.name} can return a private field`,
      ).toEqual([]);
    }
  });

  it("drops a private field a read hands over, before the model sees the result", async () => {
    for (const { name, outcome } of await callEveryTool()) {
      expect(outcome.status, name).toBe("ok");
      const output = outcome.status === "ok" ? outcome.output : null;
      expect(
        keysIn(output).filter((key) => isPrivateKey(key)),
        name,
      ).toEqual([]);
      for (const value of Object.values(PRIVATE)) {
        expect(outcome.content, name).not.toContain(String(value));
      }
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

  it("never holds more than ten items, though the reads gave fifteen homes and twenty-five localities", async () => {
    expect(MAX_TOOL_RESULT_ITEMS).toBe(10);
    const outcomes = await callEveryTool();
    const lists = outcomes.flatMap(({ outcome }) =>
      recordLists(outcome.status === "ok" ? outcome.output : null),
    );
    expect(lists.map((list) => list.length).sort()).toEqual([10, 10]);
  });

  it("returns the id of every home a result names, and of no other", async () => {
    for (const { name, outcome } of await callEveryTool()) {
      if (outcome.status !== "ok") throw new Error(`${name} did not run`);
      const named = stringsIn(outcome.output)
        .filter(({ path }) => path.at(-1) === "homeId")
        .map(({ text }) => text);
      expect(
        outcome.references.map((reference) => reference.homeId),
        name,
      ).toEqual(named);
    }
  });
});
