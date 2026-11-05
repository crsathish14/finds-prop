// @vitest-environment jsdom
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  result: { status: "missing" } as
    { status: "missing" } | { status: "found"; property: Record<string, unknown> },
}));

class Signal extends Error {}
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Signal("NOT_FOUND");
  },
  permanentRedirect: (to: string) => {
    throw new Signal(`REDIRECT ${to}`);
  },
}));
vi.mock("@/features/site", () => ({ getTranslate: async () => (key: string) => key }));
vi.mock("@/lib/public-env", () => ({
  publicEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SITE_URL: "https://findsprop.test",
  },
}));
vi.mock("@/features/home", () => ({
  LISTING_BUCKET: "listing-media",
  publicStorageUrl: (base: string, bucket: string, path: string) => `${base}/${bucket}/${path}`,
}));
vi.mock("@/features/compare", () => ({ CompareButton: () => null }));
vi.mock("@/components/domain/enquiry-card", () => ({ EnquiryCardSkeleton: () => null }));
vi.mock("@/features/property", async () => {
  const address = await vi.importActual("@/features/property/address");
  const view = await vi.importActual<Record<string, unknown>>("@/features/property/view");
  const links = await vi.importActual<Record<string, unknown>>("@/features/property/enquiry-links");
  const data = await vi.importActual<Record<string, unknown>>(
    "@/features/property/structured-data",
  );
  return {
    ...address,
    metaDescription: view["metaDescription"],
    perSqftRupees: view["perSqftRupees"],
    enquiryLinks: links["enquiryLinks"],
    propertyStructuredData: data["propertyStructuredData"],
    getProperty: async () => state.result,
    EnquiryPanel: () => null,
    MobileEnquirySlot: () => null,
    PropertyScreen: (props: { property: { title: string }; actions?: ReactNode }) => (
      <div data-testid="screen">{props.property.title}</div>
    ),
  };
});

const { default: PropertyPage, generateMetadata } =
  await import("../(public)/properties/[slug]/page");

const SLUG = "3-bhk-apartment-in-velachery";
const ID = "k3x9a2bd";
const ADDRESS = `${SLUG}-${ID}`;

const found = (overrides: Record<string, unknown> = {}) => ({
  status: "found" as const,
  property: {
    shortId: ID,
    slug: SLUG,
    title: "3 BHK apartment in Velachery",
    description: "Bright corner flat near the lake.",
    listingType: "sale",
    propertyType: "apartment",
    price: 9_500_000,
    bedrooms: 3,
    bathrooms: 2,
    areaSqft: 1450,
    amenities: ["Lift"],
    locality: "Velachery",
    city: "Chennai",
    state: "Tamil Nadu",
    publishedAt: "2026-11-01T09:00:00+00:00",
    photos: [
      { path: "a/1.webp", alt: "Living room" },
      { path: "a/2.webp", alt: null },
    ],
    ...overrides,
  },
});

const props = (slug: string) => ({ params: Promise.resolve({ slug }) });

beforeEach(() => {
  state.result = { status: "missing" };
});

describe("the property page's metadata (FR-PUB-14)", () => {
  it("titles, describes and gives the home one canonical address, its own", async () => {
    state.result = found();
    const metadata = await generateMetadata(props(ADDRESS));
    expect(metadata.title).toBe("3 BHK apartment in Velachery");
    expect(metadata.description).toBe("Bright corner flat near the lake.");
    expect(metadata.alternates?.canonical).toBe(`/properties/${ADDRESS}`);
  });

  it("shares the cover photo, described by the owner's words", async () => {
    state.result = found();
    const metadata = await generateMetadata(props(ADDRESS));
    expect(metadata.openGraph).toMatchObject({
      url: `/properties/${ADDRESS}`,
      images: [{ url: "https://example.supabase.co/listing-media/a/1.webp", alt: "Living room" }],
    });
  });

  it("shares the default image for a home with no photos", async () => {
    state.result = found({ photos: [] });
    const metadata = await generateMetadata(props(ADDRESS));
    expect(metadata.openGraph).toMatchObject({ images: [{ url: "/share-image.png" }] });
  });

  it("describes a home with no words of its own from its title", async () => {
    state.result = found({ description: null });
    expect((await generateMetadata(props(ADDRESS))).description).toBe("property.page.metaFallback");
  });

  it("titles a missing home as not found", async () => {
    expect(await generateMetadata(props(ADDRESS))).toEqual({
      title: "property.page.notFound.title",
    });
    expect(await generateMetadata(props("bad slug"))).toEqual({
      title: "property.page.notFound.title",
    });
  });
});

describe("the property page's structured data (FR-PUB-14)", () => {
  it("carries the listing and the breadcrumb trail, with whole addresses", async () => {
    state.result = found();
    const { container } = render(await PropertyPage(props(ADDRESS)));
    const documents = [...container.querySelectorAll('script[type="application/ld+json"]')].map(
      (script) => JSON.parse(script.textContent ?? ""),
    );
    expect(documents).toHaveLength(2);
    expect(documents[0]).toMatchObject({
      "@type": "RealEstateListing",
      url: `https://findsprop.test/properties/${ADDRESS}`,
      image: [
        "https://example.supabase.co/listing-media/a/1.webp",
        "https://example.supabase.co/listing-media/a/2.webp",
      ],
    });
    expect(documents[1]).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { position: 1, name: "property.page.crumb.home", item: "https://findsprop.test/" },
        {
          position: 2,
          name: "property.page.crumb.properties",
          item: "https://findsprop.test/properties",
        },
        {
          position: 3,
          name: "3 BHK apartment in Velachery",
          item: `https://findsprop.test/properties/${ADDRESS}`,
        },
      ],
    });
  });

  it("cannot be broken out of by a title that holds a closing tag", async () => {
    state.result = found({ title: "</script><script>alert(1)</script>", description: null });
    const { container } = render(await PropertyPage(props(ADDRESS)));
    expect(container.querySelectorAll("script")).toHaveLength(2);
    expect(container.innerHTML).not.toContain("</script><script>alert");
  });

  it("is not drawn for a home that is gone", async () => {
    await expect(PropertyPage(props(ADDRESS))).rejects.toThrow("NOT_FOUND");
  });
});
