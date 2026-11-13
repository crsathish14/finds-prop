import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_TOOL_RESULT_ITEMS } from "@/config/ai";
import { injected, listingRow, stringsIn, TOOL_CONTEXT } from "./fixtures";

// UT-ai-tool-search (ADR-128 section 5.1): `search_properties` over the results page's own cached read.
// The read is a stand-in here; the homes are made up.

const getSearchResults = vi.fn();
const error = vi.fn();

vi.mock("@/server/logger", () => ({ logger: { error, warn: vi.fn() } }));
// The search feature is stood in for by its read (a stand-in) and its real defaults.
vi.mock("@/features/search", async () => {
  const { DEFAULT_SORT, DEFAULT_VIEW } = await import("@/features/search/schemas");
  return { getSearchResults, DEFAULT_SORT, DEFAULT_VIEW };
});

const { toPortableJsonSchema } = await import("@/server/ai");
const { runTool } = await import("../run");
const { searchPropertiesInputSchema, searchPropertiesOutputSchema, searchPropertiesTool } =
  await import("../search-properties");

/** An input with nothing asked for: every field is required, so "not asked" is null. */
const NOTHING = {
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
};

const search = (input: Record<string, unknown>) =>
  runTool([searchPropertiesTool], { name: "search_properties", input }, TOOL_CONTEXT);

const found = (homes = [listingRow()], total = homes.length) => ({ status: "ok", homes, total });

beforeEach(() => {
  vi.clearAllMocks();
  getSearchResults.mockResolvedValue(found());
});

describe("UT-ai-tool-search: the input", () => {
  it("is called search_properties", () => {
    expect(searchPropertiesTool.name).toBe("search_properties");
  });

  it("stays inside the portable subset: every field required, 'not asked' as null", () => {
    const schema = toPortableJsonSchema(searchPropertiesInputSchema);
    expect(schema.required).toEqual(Object.keys(NOTHING));
    expect(schema.properties).toMatchObject({
      listingType: { type: ["string", "null"], enum: ["sale", "rent", null] },
      propertyType: {
        type: ["string", "null"],
        enum: ["apartment", "villa", "house", "plot", "commercial", null],
      },
      bhk: { type: ["integer", "null"] },
      minPrice: { type: ["integer", "null"] },
      maxPrice: { type: ["integer", "null"] },
      locality: { type: ["string", "null"] },
      keyword: { type: ["string", "null"] },
      label: { type: ["string", "null"], enum: ["featured", "prime", "budget", null] },
      sort: {
        type: ["string", "null"],
        enum: ["newest", "price_asc", "price_desc", "area_desc", null],
      },
      limit: { type: ["integer", "null"] },
    });
  });

  it("accepts a search with nothing asked for", () => {
    expect(searchPropertiesInputSchema.safeParse(NOTHING).success).toBe(true);
  });

  it.each([
    ["a listing type this site does not have", { listingType: "lease" }, "listingType"],
    ["a kind of property this site does not have", { propertyType: "castle" }, "propertyType"],
    ["no bedrooms", { bhk: 0 }, "bhk"],
    ["more bedrooms than the filter offers", { bhk: 5 }, "bhk"],
    ["half a bedroom", { bhk: 2.5 }, "bhk"],
    ["a price below nothing", { minPrice: -1 }, "minPrice"],
    ["a price with paise", { maxPrice: 4_999_999.5 }, "maxPrice"],
    ["a price of more than twelve digits", { maxPrice: 1_000_000_000_000 }, "maxPrice"],
    ["a price written as text", { maxPrice: "50 lakh" }, "maxPrice"],
    ["a lowest price above the highest", { minPrice: 9_000_000, maxPrice: 5_000_000 }, "minPrice"],
    ["a locality of more than 80 characters", { locality: "v".repeat(81) }, "locality"],
    ["a keyword of more than 120 characters", { keyword: "k".repeat(121) }, "keyword"],
    ["a label this site does not have", { label: "luxury" }, "label"],
    ["an order this site does not have", { sort: "cheapest" }, "sort"],
    ["a limit of nothing", { limit: 0 }, "limit"],
    ["a limit above ten", { limit: 11 }, "limit"],
  ])("refuses %s, names the field, and reads nothing", async (_case, change, field) => {
    const outcome = await search({ ...NOTHING, ...change });
    expect(outcome).toMatchObject({ status: "error", code: "invalid_input", fields: [field] });
    expect(getSearchResults).not.toHaveBeenCalled();
  });

  it("refuses a call that leaves a field out", async () => {
    const withoutLimit = Object.fromEntries(
      Object.entries(NOTHING).filter(([field]) => field !== "limit"),
    );
    expect(await search(withoutLimit)).toMatchObject({ code: "invalid_input", fields: ["limit"] });
  });

  it.each([
    ["the most bedrooms the filter offers", { bhk: 4 }],
    ["a free home", { minPrice: 0, maxPrice: 0 }],
    ["the highest price the address reads", { maxPrice: 999_999_999_999 }],
    ["a locality of exactly 80 characters", { locality: "v".repeat(80) }],
    ["a keyword of exactly 120 characters", { keyword: "k".repeat(120) }],
    ["one home", { limit: 1 }],
  ])("accepts %s", async (_case, change) => {
    expect(await search({ ...NOTHING, ...change })).toMatchObject({ status: "ok" });
  });
});

describe("UT-ai-tool-search: the read", () => {
  it("asks the results page's read for the newest ten when nothing is asked for", async () => {
    await search(NOTHING);
    expect(getSearchResults).toHaveBeenCalledExactlyOnceWith({
      sort: "newest",
      show: 10,
      view: "grid",
    });
  });

  it("passes every filter on as the search address names it", async () => {
    await search({
      listingType: "rent",
      propertyType: "villa",
      bhk: 3,
      minPrice: 20_000,
      maxPrice: 60_000,
      locality: "Velachery",
      keyword: "lake view",
      label: "prime",
      sort: "price_asc",
      limit: 5,
    });
    expect(getSearchResults).toHaveBeenCalledExactlyOnceWith({
      sort: "price_asc",
      show: 10,
      view: "grid",
      listingType: "rent",
      propertyType: "villa",
      bhk: 3,
      minPrice: 20_000,
      maxPrice: 60_000,
      locality: "Velachery",
      keyword: "lake view",
      label: "prime",
    });
  });

  it("trims text and reads blank text as not asked for", async () => {
    await search({ ...NOTHING, locality: "  Adyar ", keyword: "   " });
    expect(getSearchResults).toHaveBeenCalledExactlyOnceWith({
      sort: "newest",
      show: 10,
      view: "grid",
      locality: "Adyar",
    });
  });

  it("never sends a place, a radius or a point: the assistant has no place search", async () => {
    await search({ ...NOTHING, locality: "Guindy" });
    const [params] = getSearchResults.mock.calls[0] ?? [];
    for (const field of ["place", "lat", "lng", "radiusKm"]) {
      expect(params).not.toHaveProperty(field);
    }
  });

  it("answers 'unavailable' when the read fails, with nothing from the database", async () => {
    getSearchResults.mockResolvedValue({ status: "failed" });
    expect(await search(NOTHING)).toEqual({
      status: "error",
      code: "unavailable",
      fields: [],
      content: '{"error":"unavailable"}',
    });
    expect(error).toHaveBeenCalledExactlyOnceWith("ai tool could not run", {
      tool: "search_properties",
    });
  });
});

describe("UT-ai-tool-search: the result", () => {
  it("gives a home as compact facts, its price as the pages write it", async () => {
    getSearchResults.mockResolvedValue(found([listingRow()], 48));
    const outcome = await search(NOTHING);
    expect(outcome).toMatchObject({
      status: "ok",
      output: {
        total: 48,
        homes: [
          {
            homeId: "k3x9a2bd",
            listingType: "sale",
            propertyType: "apartment",
            bhk: 3,
            areaSqft: 1420,
            priceRupees: 12_500_000,
            priceText: "₹1.25 Cr",
            label: "featured",
            listedAgo: "3 days ago",
            untrustedText: {
              title: "3 BHK apartment with clubhouse",
              locality: "Velachery",
              city: "Chennai",
            },
          },
        ],
      },
    });
    expect(JSON.parse(outcome.content)).toEqual(outcome.status === "ok" ? outcome.output : null);
  });

  it.each([
    ["sale", 7_800_000, "₹78 L"],
    ["sale", 15_000_000, "₹1.5 Cr"],
    ["sale", 95_000, "₹95,000"],
    ["rent", 25_000, "₹25,000/mo"],
    ["rent", 150_000, "₹1.5 L/mo"],
  ] as const)("writes a %s of %i rupees as %s", async (listingType, price, text) => {
    getSearchResults.mockResolvedValue(found([listingRow({ listing_type: listingType, price })]));
    const outcome = await search(NOTHING);
    expect(outcome).toMatchObject({
      output: { homes: [{ priceRupees: price, priceText: text }] },
    });
  });

  it("returns the id and the slug of every home, for the loop to track", async () => {
    getSearchResults.mockResolvedValue(
      found([
        listingRow(),
        listingRow({ short_id: "m7p4q9wz", slug: "2-bhk-flat-adyar", title: "2 BHK flat" }),
      ]),
    );
    const outcome = await search(NOTHING);
    expect(outcome).toMatchObject({
      references: [
        { kind: "home", homeId: "k3x9a2bd", slug: "3-bhk-apartment-velachery" },
        { kind: "home", homeId: "m7p4q9wz", slug: "2-bhk-flat-adyar" },
      ],
      output: { homes: [{ homeId: "k3x9a2bd" }, { homeId: "m7p4q9wz" }] },
    });
  });

  it("does not show the model the slug, the photo or the bathrooms: they are not part of the result", async () => {
    const outcome = await search(NOTHING);
    expect(outcome.content).not.toContain("3-bhk-apartment-velachery");
    expect(outcome.content).not.toContain("front.jpg");
    expect(outcome.content).not.toContain("bathrooms");
  });

  it("never gives more than ten homes, even if the read gave more", async () => {
    const many = Array.from("abcdefghjkmnpqr", (letter) =>
      listingRow({ short_id: letter.repeat(8), title: `Home ${letter}` }),
    );
    expect(many).toHaveLength(15);
    getSearchResults.mockResolvedValue(found(many, 240));
    const outcome = await search(NOTHING);
    expect(MAX_TOOL_RESULT_ITEMS).toBe(10);
    expect(outcome).toMatchObject({ status: "ok", output: { total: 240 } });
    expect(outcome.status === "ok" ? outcome.references : []).toHaveLength(10);
    expect(JSON.parse(outcome.content).homes).toHaveLength(10);
  });

  it("gives fewer homes when fewer are asked for, and keeps the total", async () => {
    const three = ["aaaaaaaa", "bbbbbbbb", "cccccccc"].map((short_id) => listingRow({ short_id }));
    getSearchResults.mockResolvedValue(found(three, 3));
    const outcome = await search({ ...NOTHING, limit: 2 });
    expect(JSON.parse(outcome.content)).toMatchObject({
      total: 3,
      homes: [{ homeId: "aaaaaaaa" }, { homeId: "bbbbbbbb" }],
    });
    expect(outcome.status === "ok" ? outcome.references : []).toHaveLength(2);
  });

  it("gives an empty list and a total of nothing when no home matches", async () => {
    getSearchResults.mockResolvedValue(found([], 0));
    expect(await search({ ...NOTHING, locality: "Nowhere" })).toMatchObject({
      status: "ok",
      output: { total: 0, homes: [] },
      references: [],
      content: '{"total":0,"homes":[]}',
    });
  });

  it("leaves out what a home does not have, never as a zero or a blank", async () => {
    getSearchResults.mockResolvedValue(
      found([
        listingRow({
          property_type: "plot",
          bhk: 0,
          area_sqft: null,
          locality: null,
          city: " ",
          label: null,
          ageDays: null,
        }),
      ]),
    );
    expect(await search(NOTHING)).toMatchObject({
      output: {
        homes: [
          {
            propertyType: "plot",
            bhk: null,
            areaSqft: null,
            label: null,
            listedAgo: null,
            untrustedText: { locality: null, city: null },
          },
        ],
      },
    });
  });

  it("gives no kind for a kind of property this site does not know", async () => {
    getSearchResults.mockResolvedValue(found([listingRow({ property_type: "houseboat" })]));
    expect(await search(NOTHING)).toMatchObject({ output: { homes: [{ propertyType: null }] } });
  });

  it("keeps everything the lister typed under untrustedText, and nowhere else", async () => {
    getSearchResults.mockResolvedValue(
      found([
        listingRow({
          title: injected("title"),
          locality: injected("locality"),
          city: injected("city"),
        }),
      ]),
    );
    const outcome = await search(NOTHING);
    const typed = stringsIn(outcome.status === "ok" ? outcome.output : null).filter(({ text }) =>
      text.includes("Zzinject"),
    );
    expect(typed.map(({ path }) => path.join("."))).toEqual([
      "homes.0.untrustedText.title",
      "homes.0.untrustedText.locality",
      "homes.0.untrustedText.city",
    ]);
  });

  it("fits its own output schema", async () => {
    const outcome = await search(NOTHING);
    expect(
      searchPropertiesOutputSchema.safeParse(outcome.status === "ok" ? outcome.output : null)
        .success,
    ).toBe(true);
  });
});
