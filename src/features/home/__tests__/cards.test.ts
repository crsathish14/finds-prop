import { createTranslator } from "use-intl";
import { describe, expect, it } from "vitest";
import messages from "@/i18n/messages/en.json";
import type { Translate } from "@/lib/format";
import { publicStorageUrl, toDeveloperCard, toPropertyCard } from "../cards";
import type { DeveloperRow, ListingRow } from "../schemas";

const translate = createTranslator({ locale: "en", messages }) as unknown as Translate;
const SUPABASE = "https://example-project.supabase.co";
const context = { translate, supabaseUrl: SUPABASE };

const HOME: ListingRow = {
  short_id: "k3x9a2bd",
  slug: "3-bhk-apartment-velachery",
  listing_type: "sale",
  property_type: "apartment",
  title: "3 BHK apartment with clubhouse",
  bhk: 3,
  bathrooms: 2,
  area_sqft: 1420,
  price: 1_25_00_000,
  locality: "Velachery",
  city: "Chennai",
  label: "featured",
  published_at: "2026-11-01T06:00:00Z",
  cover_path: "owner-1/listing-1/front.jpg",
  cover_alt: "The front of the building",
  ageDays: 3,
};

describe("UT-home-storage-url: the address of a picture in a public bucket", () => {
  it("is the bucket's public address, with each part of the path encoded on its own", () => {
    expect(publicStorageUrl(SUPABASE, "listing-photos", "owner 1/front photo.jpg")).toBe(
      `${SUPABASE}/storage/v1/object/public/listing-photos/owner%201/front%20photo.jpg`,
    );
  });

  it("does not double the slash when the project address ends with one", () => {
    expect(publicStorageUrl(`${SUPABASE}/`, "project-media", "a/b.jpg")).toBe(
      `${SUPABASE}/storage/v1/object/public/project-media/a/b.jpg`,
    );
  });
});

describe("UT-home-property-card: a home as the property card takes it", () => {
  it("fills the card from the row", () => {
    expect(toPropertyCard(HOME, context)).toEqual({
      href: "/properties/3-bhk-apartment-velachery-k3x9a2bd",
      title: "3 BHK apartment with clubhouse",
      locality: "Velachery",
      city: "Chennai",
      rupees: 1_25_00_000,
      listingType: "sale",
      bedrooms: 3,
      bathrooms: 2,
      areaSqft: 1420,
      label: "featured",
      listedAgo: "3 days ago",
      typeLabel: "Apartment",
      cover: {
        src: `${SUPABASE}/storage/v1/object/public/listing-photos/owner-1/listing-1/front.jpg`,
        alt: "The front of the building",
      },
    });
  });

  it("leaves out the age and the kind of property when they are not known", () => {
    const card = toPropertyCard({ ...HOME, ageDays: null, property_type: "warehouse" }, context);
    expect(card).not.toHaveProperty("listedAgo");
    expect(card).not.toHaveProperty("typeLabel");
  });

  it("gives no picture when the home has none, and an empty alt when the picture has no description", () => {
    expect(toPropertyCard({ ...HOME, cover_path: null }, context).cover).toBeNull();
    expect(toPropertyCard({ ...HOME, cover_alt: null }, context).cover?.alt).toBe("");
  });

  it("keeps a missing place, bedroom count, size or label as nothing", () => {
    const card = toPropertyCard(
      {
        ...HOME,
        locality: null,
        city: null,
        bhk: null,
        bathrooms: null,
        area_sqft: null,
        label: null,
      },
      context,
    );
    expect(card).toMatchObject({
      locality: "",
      city: "",
      bedrooms: null,
      bathrooms: null,
      areaSqft: null,
      label: null,
    });
  });

  it("says Today for a home listed in the last day", () => {
    expect(toPropertyCard({ ...HOME, ageDays: 0 }, context).listedAgo).toBe("Today");
  });
});

const DEVELOPER: DeveloperRow = {
  builderId: "builder-1",
  name: "Kadal Homes",
  description: "  Builds homes along the coast.  ",
  projectCount: 5,
  projects: [
    { slug: "kadal-vista", name: "Kadal Vista", coverPath: "builder-1/project-1/a.jpg" },
    { slug: "kadal-grove", name: "Kadal Grove", coverPath: null },
  ],
};

describe("UT-home-developer-card: a developer as the developer card takes it", () => {
  it("fills the card, with the introduction trimmed and the projects linked by their slug", () => {
    expect(toDeveloperCard(DEVELOPER, 0, SUPABASE)).toEqual({
      name: "Kadal Homes",
      tint: "green",
      projectCount: 5,
      about: "Builds homes along the coast.",
      projects: [
        {
          href: "/projects/kadal-vista",
          name: "Kadal Vista",
          cover: `${SUPABASE}/storage/v1/object/public/project-media/builder-1/project-1/a.jpg`,
        },
        { href: "/projects/kadal-grove", name: "Kadal Grove", cover: null },
      ],
    });
  });

  it("goes round green, copper and sand", () => {
    const tints = [0, 1, 2, 3].map((index) => toDeveloperCard(DEVELOPER, index, SUPABASE).tint);
    expect(tints).toEqual(["green", "copper", "sand", "green"]);
  });

  it("leaves out an empty introduction", () => {
    expect(toDeveloperCard({ ...DEVELOPER, description: "   " }, 0, SUPABASE)).not.toHaveProperty(
      "about",
    );
    expect(toDeveloperCard({ ...DEVELOPER, description: null }, 0, SUPABASE)).not.toHaveProperty(
      "about",
    );
  });
});
