import { beforeEach, describe, expect, it, vi } from "vitest";
import { AS_OF_TEXT, injected, propertyData, READ_AT, stringsIn, TOOL_CONTEXT } from "./fixtures";

// UT-ai-tool-compare (ADR-128 section 5.1): `compare_properties` over the compare page's own cached read.
// The read is a stand-in here; the homes are made up.

const getComparedHomes = vi.fn();

vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/features/compare", async () => {
  const { COMPARE_MAX, COMPARE_MIN } = await import("@/features/compare/store");
  return { getComparedHomes, COMPARE_MAX, COMPARE_MIN };
});
vi.mock("@/features/property", async () => {
  const { amenityList, perSqftRupees } = await import("@/features/property/view");
  return { amenityList, perSqftRupees };
});

const { toPortableJsonSchema } = await import("@/server/ai");
const { runTool } = await import("../run");
const { compareHomesInputSchema, compareHomesOutputSchema, compareHomesTool } =
  await import("../compare-properties");

const compare = (input: unknown) =>
  runTool([compareHomesTool], { name: "compare_properties", input }, TOOL_CONTEXT);

const FIRST = "k3x9a2bd";
const SECOND = "m4y8b3ce";
const THIRD = "n5z7c4dh";

/** Homes as the compare read gives them. */
const read = (...homes: Parameters<typeof propertyData>[0][]) => ({
  properties: homes.map((overrides) => propertyData(overrides)),
  readAt: READ_AT,
});

const okOutput = async (input: unknown) => {
  const outcome = await compare(input);
  if (outcome.status !== "ok") throw new Error(`the call failed: ${outcome.content}`);
  return outcome;
};

beforeEach(() => {
  vi.clearAllMocks();
  getComparedHomes.mockResolvedValue(
    read(
      { shortId: FIRST, slug: "first", price: 12_500_000, areaSqft: 1250 },
      { shortId: SECOND, slug: "second", price: 9_000_000, areaSqft: 1000 },
    ),
  );
});

describe("UT-ai-tool-compare: the input", () => {
  it("is called compare_properties and takes a list of home ids", () => {
    expect(compareHomesTool.name).toBe("compare_properties");
    expect(compareHomesTool.kind).toBe("read");
    expect(toPortableJsonSchema(compareHomesInputSchema)).toMatchObject({
      type: "object",
      properties: { homeIds: { type: "array", items: { type: "string" } } },
      required: ["homeIds"],
      additionalProperties: false,
    });
  });

  it("reads the homes by their public ids, in order, reading capitals and spaces as the page does", async () => {
    await compare({ homeIds: [` ${FIRST.toUpperCase()} `, SECOND] });
    expect(getComparedHomes).toHaveBeenCalledExactlyOnceWith([FIRST, SECOND]);
  });

  it.each([
    ["one home", [FIRST]],
    ["no homes", []],
    ["four homes", [FIRST, SECOND, THIRD, "p6a8d5ej"]],
    ["the same home twice", [FIRST, FIRST]],
    ["the same home twice in another spelling", [FIRST, ` ${FIRST.toUpperCase()}`]],
    ["an id that is not an id", [FIRST, "3-bhk-apartment-velachery"]],
    ["a database id", [FIRST, "6f1d8a52-0c3e-4b7a-9d21-5e8f4c2a7b10"]],
    ["no list", "k3x9a2bd"],
    ["null", null],
  ])("refuses %s and reads nothing", async (_case, homeIds) => {
    expect(await compare({ homeIds })).toMatchObject({
      status: "error",
      code: "invalid_input",
      fields: ["homeIds"],
    });
    expect(getComparedHomes).not.toHaveBeenCalled();
  });
});

describe("UT-ai-tool-compare: two homes that are listed", () => {
  it("gives each home's facts with money as the pages write it, and the time it was read", async () => {
    const { output } = await okOutput({ homeIds: [FIRST, SECOND] });
    expect(output).toMatchObject({
      status: "compared",
      asOf: AS_OF_TEXT,
      notFound: [],
      homes: [
        {
          homeId: FIRST,
          listingType: "sale",
          propertyType: "apartment",
          bhk: 3,
          bathrooms: 2,
          areaSqft: 1250,
          priceRupees: 12_500_000,
          priceText: "₹1.25 Cr",
          pricePerSqftRupees: 10_000,
          pricePerSqftText: "₹10,000 per sq.ft",
          furnishing: "semi",
          label: "featured",
          untrustedText: {
            title: "3 BHK apartment with clubhouse",
            locality: "Velachery",
            city: "Chennai",
            amenities: ["Lift", "Covered parking"],
          },
        },
        { homeId: SECOND, priceText: "₹90 L", pricePerSqftRupees: 9000 },
      ],
    });
  });

  it("works the differences out in code: price, price per sq ft and area", async () => {
    const { output } = await okOutput({ homeIds: [FIRST, SECOND] });
    expect(output).toMatchObject({
      differences: {
        sameListingType: true,
        price: { lowestHomeId: SECOND, highestHomeId: FIRST, gap: 3_500_000, gapText: "₹35 L" },
        pricePerSqft: {
          lowestHomeId: SECOND,
          highestHomeId: FIRST,
          gap: 1000,
          gapText: "₹1,000 per sq.ft",
        },
        area: { lowestHomeId: SECOND, highestHomeId: FIRST, gap: 250, gapText: "250 sq.ft" },
      },
    });
  });

  it("gives the same differences whatever order the homes are asked for", async () => {
    getComparedHomes.mockResolvedValue(
      read(
        { shortId: SECOND, slug: "second", price: 9_000_000, areaSqft: 1000 },
        { shortId: FIRST, slug: "first", price: 12_500_000, areaSqft: 1250 },
      ),
    );
    const { output } = await okOutput({ homeIds: [SECOND, FIRST] });
    expect(output).toMatchObject({
      differences: { price: { lowestHomeId: SECOND, highestHomeId: FIRST } },
    });
  });

  it("names the home of each reference by id and slug, in the order given", async () => {
    const outcome = await okOutput({ homeIds: [FIRST, SECOND] });
    expect(outcome.references).toEqual([
      { kind: "home", homeId: FIRST, slug: "first" },
      { kind: "home", homeId: SECOND, slug: "second" },
    ]);
  });
});

describe("UT-ai-tool-compare: gaps that are zero or cannot be worked out", () => {
  it("says nobody is lower or higher when the values are equal", async () => {
    getComparedHomes.mockResolvedValue(
      read(
        { shortId: FIRST, slug: "first", price: 9_000_000, areaSqft: 1000 },
        { shortId: SECOND, slug: "second", price: 9_000_000, areaSqft: 1000 },
      ),
    );
    const { output } = await okOutput({ homeIds: [FIRST, SECOND] });
    expect(output).toMatchObject({
      differences: {
        price: { lowestHomeId: null, highestHomeId: null, gap: 0 },
        area: { lowestHomeId: null, highestHomeId: null, gap: 0 },
      },
    });
  });

  it("leaves the price per sq ft and the area out when only one home has an area", async () => {
    getComparedHomes.mockResolvedValue(
      read(
        { shortId: FIRST, slug: "first", areaSqft: 1250 },
        { shortId: SECOND, slug: "second", areaSqft: null },
      ),
    );
    const { output } = await okOutput({ homeIds: [FIRST, SECOND] });
    expect(output).toMatchObject({
      homes: [{ pricePerSqftRupees: 10_000 }, { pricePerSqftRupees: null, pricePerSqftText: null }],
      differences: { pricePerSqft: null, area: null },
    });
  });

  it("does not put a sale price beside a rent: there is no price gap and no price per sq ft for a rent", async () => {
    getComparedHomes.mockResolvedValue(
      read(
        { shortId: FIRST, slug: "first", price: 12_500_000, areaSqft: 1250 },
        { shortId: SECOND, slug: "second", listingType: "rent", price: 25_000, areaSqft: 1000 },
      ),
    );
    const { output } = await okOutput({ homeIds: [FIRST, SECOND] });
    expect(output).toMatchObject({
      homes: [{ priceText: "₹1.25 Cr" }, { priceText: "₹25,000/mo", pricePerSqftRupees: null }],
      differences: { sameListingType: false, price: null, pricePerSqft: null },
    });
  });

  it("writes the price gap of two rents as a monthly rent", async () => {
    getComparedHomes.mockResolvedValue(
      read(
        { shortId: FIRST, slug: "first", listingType: "rent", price: 25_000 },
        { shortId: SECOND, slug: "second", listingType: "rent", price: 18_000 },
      ),
    );
    const { output } = await okOutput({ homeIds: [FIRST, SECOND] });
    expect(output).toMatchObject({
      differences: { price: { gap: 7000, gapText: "₹7,000/mo" }, pricePerSqft: null },
    });
  });

  it("treats a plot's zero bedrooms and an area of zero as not known, as the page does", async () => {
    getComparedHomes.mockResolvedValue(
      read(
        { shortId: FIRST, slug: "first", propertyType: "plot", bedrooms: 0, areaSqft: 0 },
        { shortId: SECOND, slug: "second", bedrooms: null, areaSqft: 1000 },
      ),
    );
    const { output } = await okOutput({ homeIds: [FIRST, SECOND] });
    expect(output).toMatchObject({
      homes: [
        { bhk: null, areaSqft: null, pricePerSqftRupees: null },
        { bhk: null, areaSqft: 1000 },
      ],
      differences: { area: null },
    });
  });
});

describe("UT-ai-tool-compare: homes that are not listed", () => {
  it("compares the homes that remain and names the one that is gone", async () => {
    getComparedHomes.mockResolvedValue(
      read(
        { shortId: FIRST, slug: "first" },
        { shortId: THIRD, slug: "third", price: 8_000_000, areaSqft: 900 },
      ),
    );
    const { output, references } = await okOutput({ homeIds: [FIRST, SECOND, THIRD] });
    expect(output).toMatchObject({ status: "compared", notFound: [SECOND] });
    expect(references.map((reference) => reference.kind)).toEqual(["home", "home"]);
  });

  it("says there are not enough homes, and names no reference, when fewer than two are listed", async () => {
    getComparedHomes.mockResolvedValue(read({ shortId: FIRST, slug: "first" }));
    const { output, references } = await okOutput({ homeIds: [FIRST, SECOND] });
    expect(output).toEqual({
      status: "not_enough_homes",
      asOf: AS_OF_TEXT,
      listedCount: 1,
      notFound: [SECOND],
    });
    expect(references).toEqual([]);
  });

  it("says so when none are listed", async () => {
    getComparedHomes.mockResolvedValue(read());
    const { output } = await okOutput({ homeIds: [FIRST, SECOND] });
    expect(output).toMatchObject({
      status: "not_enough_homes",
      listedCount: 0,
      notFound: [FIRST, SECOND],
    });
  });
});

describe("UT-ai-tool-compare: third-party text and failures", () => {
  it("puts everything a lister typed under untrustedText, and nowhere else", async () => {
    getComparedHomes.mockResolvedValue(
      read(
        {
          shortId: FIRST,
          slug: "first",
          title: injected("title"),
          locality: injected("locality"),
          city: injected("city"),
          amenities: [injected("amenity")],
        },
        { shortId: SECOND, slug: "second" },
      ),
    );
    const { output } = await okOutput({ homeIds: [FIRST, SECOND] });
    const typed = stringsIn(output).filter(({ text }) => text.includes("Zzinject"));
    expect(typed.map(({ path }) => path.join("."))).toEqual([
      "homes.0.untrustedText.title",
      "homes.0.untrustedText.locality",
      "homes.0.untrustedText.city",
      "homes.0.untrustedText.amenities.0",
    ]);
  });

  it("keeps only what the output schema names", async () => {
    getComparedHomes.mockResolvedValue({
      properties: [
        { ...propertyData({ shortId: FIRST, slug: "first" }), ownerName: "Made-up Owner" },
        propertyData({ shortId: SECOND, slug: "second" }),
      ],
      readAt: READ_AT,
    });
    const outcome = await okOutput({ homeIds: [FIRST, SECOND] });
    expect(outcome.content).not.toContain("Made-up Owner");
    expect(compareHomesOutputSchema.safeParse(outcome.output).success).toBe(true);
  });

  it("answers unavailable, not an exception, when the read fails", async () => {
    getComparedHomes.mockRejectedValue(new Error("property could not be read"));
    expect(await compare({ homeIds: [FIRST, SECOND] })).toMatchObject({
      status: "error",
      code: "unavailable",
    });
  });
});

describe("UT-ai-tool-compare: an id that is not text", () => {
  it("names the entry to correct and reads nothing", async () => {
    expect(await compare({ homeIds: [FIRST, 12345678] })).toMatchObject({
      status: "error",
      code: "invalid_input",
      fields: ["homeIds.1"],
    });
    expect(getComparedHomes).not.toHaveBeenCalled();
  });
});
