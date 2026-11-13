import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_UNTRUSTED_TEXT_CHARACTERS } from "@/config/ai";
import { AS_OF_TEXT, injected, propertyData, READ_AT, stringsIn, TOOL_CONTEXT } from "./fixtures";

// UT-ai-tool-property (ADR-128 section 5.1): `get_property` over the property page's own cached read.
// The read is a stand-in here; the home is made up.

const getProperty = vi.fn();
const error = vi.fn();

vi.mock("@/server/logger", () => ({ logger: { error, warn: vi.fn() } }));
// The property feature is stood in for by its read (a stand-in) and its real page rules.
vi.mock("@/features/property", async () => {
  const { amenityList, perSqftRupees } = await import("@/features/property/view");
  return { getProperty, amenityList, perSqftRupees };
});

const { toPortableJsonSchema } = await import("@/server/ai");
const { runTool } = await import("../run");
const { getPropertyInputSchema, getPropertyOutputSchema, getPropertyTool } =
  await import("../get-property");

const get = (input: unknown) =>
  runTool([getPropertyTool], { name: "get_property", input }, TOOL_CONTEXT);

const found = (overrides: Parameters<typeof propertyData>[0] = {}) => ({
  status: "found",
  property: propertyData(overrides),
  readAt: READ_AT,
});

beforeEach(() => {
  vi.clearAllMocks();
  getProperty.mockResolvedValue(found());
});

describe("UT-ai-tool-property: the input", () => {
  it("is called get_property and takes one home id", () => {
    expect(getPropertyTool.name).toBe("get_property");
    expect(toPortableJsonSchema(getPropertyInputSchema)).toMatchObject({
      type: "object",
      properties: { homeId: { type: "string" } },
      required: ["homeId"],
      additionalProperties: false,
    });
  });

  it("reads the home by its public id", async () => {
    await get({ homeId: "k3x9a2bd" });
    expect(getProperty).toHaveBeenCalledExactlyOnceWith("k3x9a2bd");
  });

  it("reads capitals and stray spaces as the page does", async () => {
    await get({ homeId: " K3X9A2BD " });
    expect(getProperty).toHaveBeenCalledExactlyOnceWith("k3x9a2bd");
  });

  it.each([
    ["nothing", ""],
    ["too few characters", "k3x9a2b"],
    ["too many characters", "k3x9a2bdd"],
    ["a look-alike character the ids never use", "k3x9a2b0"],
    ["a whole address", "3-bhk-apartment-velachery-k3x9a2bd"],
    ["a database id", "6f1d8a52-0c3e-4b7a-9d21-5e8f4c2a7b10"],
    ["a number", 12345678],
    ["no id", null],
  ])("refuses %s as an id and reads nothing", async (_case, homeId) => {
    expect(await get({ homeId })).toMatchObject({
      status: "error",
      code: "invalid_input",
      fields: ["homeId"],
    });
    expect(getProperty).not.toHaveBeenCalled();
  });
});

describe("UT-ai-tool-property: a home that is listed", () => {
  it("gives the facts the page shows, with money as the page writes it", async () => {
    const outcome = await get({ homeId: "k3x9a2bd" });
    expect(outcome).toEqual({
      status: "ok",
      output: {
        status: "found",
        asOf: AS_OF_TEXT,
        home: {
          homeId: "k3x9a2bd",
          listingType: "sale",
          propertyType: "apartment",
          bhk: 3,
          bathrooms: 2,
          areaSqft: 1420,
          priceRupees: 12_500_000,
          priceText: "₹1.25 Cr",
          pricePerSqftText: "₹8,803 per sq.ft",
          furnishing: "semi",
          availableFrom: "2026-12-01",
          label: "featured",
          listedAgo: "3 days ago",
          photoCount: 2,
          descriptionShortened: false,
          untrustedText: {
            title: "3 BHK apartment with clubhouse",
            description: "Bright corner flat on the fourth floor.\n\nTen minutes from the station.",
            amenities: ["Lift", "Covered parking"],
            locality: "Velachery",
            city: "Chennai",
          },
        },
      },
      references: [{ kind: "home", homeId: "k3x9a2bd", slug: "3-bhk-apartment-velachery" }],
      content: expect.any(String),
    });
    expect(JSON.parse(outcome.content)).toEqual(outcome.status === "ok" ? outcome.output : null);
  });

  it("writes a rent by the month and gives it no price per square foot", async () => {
    getProperty.mockResolvedValue(found({ listingType: "rent", price: 25_000 }));
    expect(await get({ homeId: "k3x9a2bd" })).toMatchObject({
      output: {
        home: { priceRupees: 25_000, priceText: "₹25,000/mo", pricePerSqftText: null },
      },
    });
  });

  it("gives no price per square foot when the area is not known", async () => {
    getProperty.mockResolvedValue(found({ areaSqft: null }));
    expect(await get({ homeId: "k3x9a2bd" })).toMatchObject({
      output: { home: { areaSqft: null, pricePerSqftText: null } },
    });
  });

  it("leaves out what the owner did not give, never as a zero or a blank", async () => {
    getProperty.mockResolvedValue(
      found({
        propertyType: "plot",
        description: "  ",
        bedrooms: 0,
        bathrooms: null,
        furnishing: null,
        amenities: [" ", ""],
        availableFrom: null,
        locality: null,
        city: null,
        label: null,
        ageDays: null,
        photos: [],
      }),
    );
    expect(await get({ homeId: "k3x9a2bd" })).toMatchObject({
      output: {
        home: {
          bhk: null,
          bathrooms: null,
          furnishing: null,
          availableFrom: null,
          label: null,
          listedAgo: null,
          photoCount: 0,
          descriptionShortened: false,
          untrustedText: { description: null, amenities: [], locality: null, city: null },
        },
      },
    });
  });

  it("cuts a long description, says so, and never passes the limit", async () => {
    getProperty.mockResolvedValue(found({ description: "Sea view. ".repeat(500) }));
    const outcome = await get({ homeId: "k3x9a2bd" });
    const home = outcome.status === "ok" ? getPropertyOutputSchema.parse(outcome.output) : null;
    expect(home?.status === "found" ? home.home.descriptionShortened : null).toBe(true);
    const description = home?.status === "found" ? home.home.untrustedText.description : null;
    expect(description?.length).toBeLessThanOrEqual(MAX_UNTRUSTED_TEXT_CHARACTERS);
    expect(description?.startsWith("Sea view. Sea view.")).toBe(true);
  });

  it("keeps everything the owner typed under untrustedText, and nowhere else", async () => {
    getProperty.mockResolvedValue(
      found({
        title: injected("title"),
        description: injected("description"),
        amenities: [injected("amenity")],
        locality: injected("locality"),
        city: injected("city"),
        state: injected("state"),
        photos: [{ path: "owner-1/listing-1/front.jpg", alt: injected("photo") }],
      }),
    );
    const outcome = await get({ homeId: "k3x9a2bd" });
    const typed = stringsIn(outcome.status === "ok" ? outcome.output : null).filter(({ text }) =>
      text.includes("Zzinject"),
    );
    expect(typed.map(({ path }) => path.join("."))).toEqual([
      "home.untrustedText.title",
      "home.untrustedText.description",
      "home.untrustedText.amenities.0",
      "home.untrustedText.locality",
      "home.untrustedText.city",
    ]);
  });

  it("does not show the model the database id, the slug or a photo's address", async () => {
    const outcome = await get({ homeId: "k3x9a2bd" });
    expect(outcome.content).not.toContain("6f1d8a52-0c3e-4b7a-9d21-5e8f4c2a7b10");
    expect(outcome.content).not.toContain("3-bhk-apartment-velachery");
    expect(outcome.content).not.toContain("front.jpg");
  });
});

describe("UT-ai-tool-property: a home that is gone", () => {
  it("answers not_found for a home that is sold, rented, withdrawn or never listed", async () => {
    getProperty.mockResolvedValue({ status: "missing", readAt: READ_AT });
    expect(await get({ homeId: "m7p4q9wz" })).toEqual({
      status: "ok",
      output: { status: "not_found", asOf: AS_OF_TEXT },
      references: [],
      content: `{"status":"not_found","asOf":"${AS_OF_TEXT}"}`,
    });
    expect(error).not.toHaveBeenCalled();
  });

  it("answers 'unavailable', not 'not_found', when the read fails: a failed read is not a home that is gone", async () => {
    getProperty.mockRejectedValue(new Error("property could not be read"));
    expect(await get({ homeId: "k3x9a2bd" })).toEqual({
      status: "error",
      code: "unavailable",
      fields: [],
      content: '{"error":"unavailable"}',
    });
    expect(error).toHaveBeenCalledExactlyOnceWith("ai tool could not run", {
      tool: "get_property",
    });
  });
});
