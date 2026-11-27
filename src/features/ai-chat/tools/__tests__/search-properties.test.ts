import { beforeEach, describe, expect, it, vi } from "vitest";
import { AI_SEARCH_PAGE_SIZE } from "@/config/ai";
import { AS_OF_TEXT, injected, listingRow, READ_AT, stringsIn, TOOL_CONTEXT } from "./fixtures";

// UT-ai-tool-search (ADR-128 section 5.1): `search_properties` over the results page's own cached read.
// The read is a stand-in here; the homes are made up.

const getSearchResults = vi.fn();
const error = vi.fn();
const getHomeExtras = vi.fn();

// The ranking's own reads (ADR-205): the homes' amenities and furnishing, stood in for here.
vi.mock("../../ranking/reads.server", () => ({
  getHomeExtras,
  getProjectExtras: vi.fn(),
  getPromotionLists: vi.fn(),
}));

vi.mock("@/server/logger", () => ({ logger: { error, warn: vi.fn() } }));
// The search feature is stood in for by its read (a stand-in) and its real defaults.
// The one list of homes and projects (ADR-215) has its own tests (search-properties-projects.test.ts): here no
// project matches, so these tests see the homes alone.
vi.mock("../listing-projects", () => ({ projectsForHomeSearch: vi.fn(async () => null) }));
vi.mock("../search-projects", () => ({ toProjectSummary: vi.fn() }));
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

const { toPortableJsonSchema } = await import("@/server/ai");
const { runTool } = await import("../run");
const { searchPropertiesInputSchema, searchPropertiesOutputSchema, searchPropertiesTool } =
  await import("../search-properties");
const { createTurnMemory } = await import("../../state/memory");

/** An input with nothing asked for: every field is required, so "not asked" is null. */
const NOTHING = {
  listingType: null,
  propertyType: null,
  bhk: null,
  minPrice: null,
  maxPrice: null,
  city: null,
  locality: null,
  keyword: null,
  label: null,
  preferLocalities: null,
  preferAmenities: null,
  preferFurnishing: null,
  sort: null,
  page: null,
};

const search = (input: Record<string, unknown>) =>
  runTool([searchPropertiesTool], { name: "search_properties", input }, TOOL_CONTEXT);

const found = (homes = [listingRow()], total = homes.length) => ({
  status: "ok",
  homes,
  total,
  readAt: READ_AT,
});

beforeEach(() => {
  vi.clearAllMocks();
  getSearchResults.mockResolvedValue(found());
  getHomeExtras.mockResolvedValue(new Map());
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
      page: { type: ["string", "null"], enum: ["next", null] },
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
    ["a page this tool does not have", { page: "previous" }, "page"],
  ])("refuses %s, names the field, and reads nothing", async (_case, change, field) => {
    const outcome = await search({ ...NOTHING, ...change });
    expect(outcome).toMatchObject({ status: "error", code: "invalid_input", fields: [field] });
    expect(getSearchResults).not.toHaveBeenCalled();
  });

  it("refuses a call that leaves a field out", async () => {
    const withoutPage = Object.fromEntries(
      Object.entries(NOTHING).filter(([field]) => field !== "page"),
    );
    expect(await search(withoutPage)).toMatchObject({ code: "invalid_input", fields: ["page"] });
  });

  it.each([
    ["the most bedrooms the filter offers", { bhk: 4 }],
    ["a free home", { minPrice: 0, maxPrice: 0 }],
    ["the highest price the address reads", { maxPrice: 999_999_999_999 }],
    ["a locality of exactly 80 characters", { locality: "v".repeat(80) }],
    ["a keyword of exactly 120 characters", { keyword: "k".repeat(120) }],
    ["the next page", { page: "next" }],
  ])("accepts %s", async (_case, change) => {
    expect(await search({ ...NOTHING, ...change })).toMatchObject({ status: "ok" });
  });
});

describe("UT-ai-tool-search: the read", () => {
  it("asks the results page's read for the newest ten when nothing is asked for", async () => {
    await search(NOTHING);
    expect(getSearchResults).toHaveBeenCalledExactlyOnceWith(
      {
        sort: "newest",
        show: 120,
        view: "grid",
      },
      { guest: false },
    );
  });

  it("passes every filter on as the search address names it", async () => {
    await search({
      listingType: "rent",
      propertyType: "villa",
      bhk: 3,
      minPrice: 20_000,
      maxPrice: 60_000,
      city: null,
      locality: "Velachery",
      keyword: "lake view",
      label: "prime",
      preferLocalities: null,
      preferAmenities: null,
      preferFurnishing: null,
      sort: "price_asc",
      page: null,
    });
    expect(getSearchResults).toHaveBeenCalledExactlyOnceWith(
      {
        sort: "price_asc",
        show: 120,
        view: "grid",
        listingType: "rent",
        propertyType: "villa",
        bhk: 3,
        minPrice: 20_000,
        maxPrice: 60_000,
        locality: "Velachery",
        keyword: "lake view",
        label: "prime",
      },
      { guest: false },
    );
  });

  it("trims text and reads blank text as not asked for", async () => {
    await search({ ...NOTHING, locality: "  Adyar ", keyword: "   " });
    expect(getSearchResults).toHaveBeenCalledExactlyOnceWith(
      {
        sort: "newest",
        show: 120,
        view: "grid",
        locality: "Adyar",
      },
      { guest: false },
    );
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

describe("UT-ai-tool-search: a city given as a locality (ADR-178)", () => {
  it("tries the same words once as a keyword when a locality alone finds nothing, and gives that answer", async () => {
    getSearchResults.mockResolvedValueOnce(found([], 0)).mockResolvedValueOnce(found());
    const outcome = await search({ ...NOTHING, listingType: "sale", locality: "Chennai" });
    expect(outcome.status).toBe("ok");
    expect(getSearchResults).toHaveBeenCalledTimes(2);
    expect(getSearchResults.mock.calls[0]?.[0]).toMatchObject({ locality: "Chennai" });
    const second = getSearchResults.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(second).toMatchObject({ keyword: "Chennai", listingType: "sale" });
    expect(second).not.toHaveProperty("locality");
    expect(outcome.status === "ok" ? (outcome.output as { total: number }).total : 0).toBe(1);
  });

  it("does not try again when the locality found homes, when there was no locality, or when a keyword was given", async () => {
    await search({ ...NOTHING, locality: "Velachery" });
    expect(getSearchResults).toHaveBeenCalledTimes(1);
    getSearchResults.mockClear();
    getSearchResults.mockResolvedValue(found([], 0));
    await search({ ...NOTHING });
    expect(getSearchResults).toHaveBeenCalledTimes(1);
    getSearchResults.mockClear();
    await search({ ...NOTHING, locality: "Adyar", keyword: "garden" });
    expect(getSearchResults).toHaveBeenCalledTimes(1);
  });

  it("gives the first answer, an honest nothing, when the second read finds nothing too or fails", async () => {
    getSearchResults.mockResolvedValueOnce(found([], 0)).mockResolvedValueOnce(found([], 0));
    const empty = await search({ ...NOTHING, locality: "Nowhere" });
    expect(empty.status === "ok" ? (empty.output as { total: number }).total : -1).toBe(0);
    getSearchResults
      .mockResolvedValueOnce(found([], 0))
      .mockResolvedValueOnce({ status: "failed" });
    const failed = await search({ ...NOTHING, locality: "Nowhere" });
    expect(failed.status === "ok" ? (failed.output as { total: number }).total : -1).toBe(0);
  });

  it("tells the model a city goes in the city filter, not the locality", () => {
    const shape = searchPropertiesInputSchema.shape;
    expect(shape.locality.description).toContain("put a city in `city`");
    expect(shape.city.description).toContain("a neighbourhood goes in `locality`");
  });
});

describe("UT-ai-tool-search: the city filter (ADR-204)", () => {
  it("sends the city to the search's own city filter, as a city key", async () => {
    await search({ ...NOTHING, bhk: 3, city: " Chennai " });
    expect(getSearchResults).toHaveBeenCalledExactlyOnceWith(
      { sort: "newest", show: 120, view: "grid", bhk: 3 },
      { guest: false, city: "chennai" },
    );
  });

  it("sends no city filter for a city with no Latin letter or digit in it", async () => {
    await search({ ...NOTHING, city: "சென்னை" });
    expect(getSearchResults).toHaveBeenCalledExactlyOnceWith(
      { sort: "newest", show: 120, view: "grid" },
      { guest: false },
    );
  });

  it("tries a city that found nothing once as a keyword, without the city filter", async () => {
    getSearchResults.mockResolvedValueOnce(found([], 0)).mockResolvedValueOnce(found());
    const outcome = await search({ ...NOTHING, city: "OMR" });
    expect(getSearchResults).toHaveBeenCalledTimes(2);
    expect(getSearchResults.mock.calls[1]).toEqual([
      { sort: "newest", show: 120, view: "grid", keyword: "OMR" },
      { guest: false },
    ]);
    expect(outcome.status === "ok" ? (outcome.output as { total: number }).total : 0).toBe(1);
  });

  it("keeps the city when a locality inside it found nothing and is tried as a keyword", async () => {
    getSearchResults.mockResolvedValueOnce(found([], 0)).mockResolvedValueOnce(found());
    await search({ ...NOTHING, city: "Chennai", locality: "Thoraipakkam" });
    expect(getSearchResults.mock.calls[1]).toEqual([
      { sort: "newest", show: 120, view: "grid", keyword: "Thoraipakkam" },
      { guest: false, city: "chennai" },
    ]);
  });

  it("refuses a city longer than 80 characters", async () => {
    expect(await search({ ...NOTHING, city: "c".repeat(81) })).toMatchObject({ status: "error" });
  });
});

describe("UT-ai-tool-search: the result", () => {
  it("gives a home as compact facts, its price as the pages write it", async () => {
    getSearchResults.mockResolvedValue(found([listingRow()], 48));
    const outcome = await search(NOTHING);
    expect(outcome).toMatchObject({
      status: "ok",
      output: {
        asOf: AS_OF_TEXT,
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
            // The chat never says a home is featured (owner, 26 Nov 2026): the label is only a price band.
            label: null,
            listedAgo: "3 days ago",
            matchReasons: ["listed in the last week"],
            missedPreferences: [],
            lowestPriceOfMatches: true,
            largestOfMatches: true,
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

  it("gives one page of six homes, even if the read gave more", async () => {
    const many = Array.from("abcdefghjkmnpqr", (letter) =>
      listingRow({ short_id: letter.repeat(8), title: `Home ${letter}` }),
    );
    expect(many).toHaveLength(15);
    getSearchResults.mockResolvedValue(found(many, 240));
    const outcome = await search(NOTHING);
    expect(AI_SEARCH_PAGE_SIZE).toBe(6);
    expect(outcome).toMatchObject({ status: "ok", output: { total: 240, shownSoFar: 6 } });
    expect(outcome.status === "ok" ? outcome.references : []).toHaveLength(6);
    expect(JSON.parse(outcome.content).homes).toHaveLength(6);
  });

  it("gives an empty list and a total of nothing when no home matches", async () => {
    getSearchResults.mockResolvedValue(found([], 0));
    expect(await search({ ...NOTHING, locality: "Nowhere" })).toMatchObject({
      status: "ok",
      output: { total: 0, homes: [] },
      references: [],
      content: `{"asOf":"${AS_OF_TEXT}","total":0,"ranked":true,"rankedAll":true,"shownSoFar":0,"homes":[],"projects":[],"order":[],"slightlyAboveBudget":null}`,
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

describe("UT-ai-tool-search: the ranking (ADR-205)", () => {
  it("ranks the home with the preferred amenity first, reading amenities only when one is preferred", async () => {
    getSearchResults.mockResolvedValue(
      found([
        listingRow({ short_id: "no-pool1", label: null }),
        listingRow({ short_id: "pool0001", label: null }),
      ]),
    );
    await search({ ...NOTHING });
    expect(getHomeExtras).not.toHaveBeenCalled();
    getHomeExtras.mockResolvedValue(
      new Map([
        ["no-pool1", { amenities: ["Gym"], furnishing: null }],
        ["pool0001", { amenities: ["Swimming pool"], furnishing: null }],
      ]),
    );
    const outcome = await search({ ...NOTHING, preferAmenities: ["swimming pool"] });
    expect(getHomeExtras).toHaveBeenCalledWith(["no-pool1", "pool0001"]);
    const homes =
      outcome.status === "ok"
        ? (outcome.output as { homes: { homeId: string; matchReasons: string[] }[] }).homes
        : [];
    expect(homes.map((home) => home.homeId)).toEqual(["pool0001", "no-pool1"]);
    expect(homes[0]?.matchReasons).toContain("has swimming pool");
  });

  it("keeps the order the customer asked for, and says so", async () => {
    getSearchResults.mockResolvedValue(
      found([
        listingRow({ short_id: "cheap0001", price: 5_000_000 }),
        listingRow({ short_id: "dear00001", price: 9_000_000 }),
      ]),
    );
    const outcome = await search({ ...NOTHING, sort: "price_asc" });
    expect(outcome).toMatchObject({
      status: "ok",
      output: { ranked: false, homes: [{ homeId: "cheap0001" }, { homeId: "dear00001" }] },
    });
  });

  it("offers one featured home at most 10% over the maximum apart, and never as a match", async () => {
    const near = listingRow({ short_id: "near0001", price: 8_500_000, label: "featured" });
    getSearchResults
      .mockResolvedValueOnce(
        found([listingRow({ short_id: "match001", price: 7_000_000, label: null })]),
      )
      .mockResolvedValueOnce(found([near]));
    const outcome = await search({ ...NOTHING, maxPrice: 8_000_000 });
    expect(getSearchResults).toHaveBeenCalledTimes(2);
    expect(getSearchResults.mock.calls[1]?.[0]).toMatchObject({
      minPrice: 8_000_001,
      maxPrice: 8_800_000,
      label: "featured",
      sort: "price_asc",
    });
    expect(outcome).toMatchObject({
      status: "ok",
      output: {
        total: 1,
        homes: [{ homeId: "match001" }],
        slightlyAboveBudget: { homeId: "near0001", label: null },
      },
    });
    expect(
      outcome.status === "ok" &&
        outcome.references.map((reference) => "homeId" in reference && reference.homeId),
    ).toEqual(["match001", "near0001"]);
  });

  it("looks for no home above the budget without a maximum, with a label, or for a guest", async () => {
    await search({ ...NOTHING });
    await search({ ...NOTHING, maxPrice: 8_000_000, label: "budget" });
    await runTool(
      [searchPropertiesTool],
      { name: "search_properties", input: { ...NOTHING, maxPrice: 8_000_000 } },
      { ...TOOL_CONTEXT, signedIn: false },
    );
    expect(getSearchResults).toHaveBeenCalledTimes(3);
  });

  it("never tells the model a home is featured", async () => {
    const outcome = await search({ ...NOTHING });
    expect(outcome.status === "ok" && outcome.content).not.toMatch(/featured|sponsor|promot/iu);
  });
});

describe("UT-ai-tool-search-paging: one page at a time, never the same home twice (ADR-206)", () => {
  const homes = Array.from("abcdefghjkmnpqr", (letter) =>
    listingRow({ short_id: letter.repeat(8), title: `Home ${letter}` }),
  );
  const pageIds = (content: string): string[] =>
    (JSON.parse(content) as { homes: { homeId: string }[] }).homes.map((home) => home.homeId);

  it("gives the next six with page next and the same filters, then the rest, with no repeat", async () => {
    getSearchResults.mockResolvedValue(found(homes, 15));
    const memory = createTurnMemory(null);
    const context = { ...TOOL_CONTEXT, search: memory };
    const run = (input: Record<string, unknown>) =>
      runTool([searchPropertiesTool], { name: "search_properties", input }, context);
    const first = await run({ ...NOTHING, bhk: 2 });
    const second = await run({ ...NOTHING, bhk: 2, page: "next" });
    const third = await run({ ...NOTHING, bhk: 2, page: "next" });
    const ids = [first, second, third].map((outcome) => pageIds(outcome.content));
    expect(ids.map((page) => page.length)).toEqual([6, 6, 3]);
    expect(new Set(ids.flat()).size).toBe(15);
    expect(JSON.parse(third.content)).toMatchObject({ total: 15, shownSoFar: 15 });
    expect(memory.current()).toMatchObject({ tool: "search_properties", total: 15 });
    expect(memory.current()?.shown).toHaveLength(15);
  });

  it("starts the ranking again when a filter changes, and marks the homes seen before", async () => {
    getSearchResults.mockResolvedValue(found(homes, 15));
    const memory = createTurnMemory(null);
    const context = { ...TOOL_CONTEXT, search: memory };
    const run = (input: Record<string, unknown>) =>
      runTool([searchPropertiesTool], { name: "search_properties", input }, context);
    const first = await run({ ...NOTHING, bhk: 2 });
    expect(
      (JSON.parse(first.content) as { homes: { seenBefore: boolean }[] }).homes.every(
        (home) => !home.seenBefore,
      ),
    ).toBe(true);
    const changed = await run({ ...NOTHING, bhk: 3, page: "next" });
    expect(pageIds(changed.content)).toEqual(pageIds(first.content));
    expect(
      (JSON.parse(changed.content) as { homes: { seenBefore: boolean }[] }).homes.every(
        (home) => home.seenBefore,
      ),
    ).toBe(true);
    expect(JSON.parse(changed.content)).toMatchObject({ shownSoFar: 6 });
  });

  it("treats the same filters written in other case or spacing as the same search", async () => {
    getSearchResults.mockResolvedValue(found(homes, 15));
    const memory = createTurnMemory(null);
    const context = { ...TOOL_CONTEXT, search: memory };
    const run = (input: Record<string, unknown>) =>
      runTool([searchPropertiesTool], { name: "search_properties", input }, context);
    const first = await run({ ...NOTHING, city: "Chennai", preferAmenities: ["pool", "gym"] });
    const next = await run({
      ...NOTHING,
      city: " chennai ",
      preferAmenities: ["Gym", "Pool"],
      page: "next",
    });
    expect(pageIds(next.content).some((id) => pageIds(first.content).includes(id))).toBe(false);
  });

  it("without a memory, page next is a first page", async () => {
    getSearchResults.mockResolvedValue(found(homes, 15));
    const next = await search({ ...NOTHING, page: "next" });
    expect(pageIds(next.content)).toHaveLength(6);
    expect(JSON.parse(next.content)).toMatchObject({ shownSoFar: 6 });
  });
});
