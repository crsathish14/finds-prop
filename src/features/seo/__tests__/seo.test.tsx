// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/public-env", () => ({
  publicEnv: { NEXT_PUBLIC_SITE_URL: "https://www.findsprop.test/some/path?x=1" },
}));

const { JsonLd } = await import("../json-ld");
const { NO_INDEX, pageMetadata, SHARE_IMAGE_PATH } = await import("../metadata");
const { DISALLOWED_PATHS, robotsFile } = await import("../robots");
const { absoluteUrl, siteOrigin } = await import("../site-url");
const { breadcrumbList, compact, postalAddress, serializeJsonLd } =
  await import("../structured-data");

describe("UT-seo: the site address", () => {
  it("is the origin of the configured address: no path, no query, no trailing slash", () => {
    expect(siteOrigin()).toBe("https://www.findsprop.test");
  });

  it("makes a path whole", () => {
    expect(absoluteUrl("/properties?bhk=3")).toBe("https://www.findsprop.test/properties?bhk=3");
    expect(absoluteUrl("/")).toBe("https://www.findsprop.test/");
  });
});

describe("UT-seo: a page's metadata", () => {
  const input = {
    title: "Apartments for sale in Velachery",
    description: "Photos, prices and details.",
    path: "/properties?locality=Velachery",
    siteName: "Find Prop",
  };

  it("holds the title, description, canonical address and the share tags", () => {
    const metadata = pageMetadata(input);
    expect(metadata.title).toBe("Apartments for sale in Velachery");
    expect(metadata.description).toBe("Photos, prices and details.");
    expect(metadata.alternates?.canonical).toBe("/properties?locality=Velachery");
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      title: "Apartments for sale in Velachery",
      description: "Photos, prices and details.",
      url: "/properties?locality=Velachery",
      siteName: "Find Prop",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Apartments for sale in Velachery",
    });
  });

  it("falls back to the brand card, at its size, when the page has no picture", () => {
    const metadata = pageMetadata(input);
    expect(metadata.openGraph).toMatchObject({
      images: [{ url: SHARE_IMAGE_PATH, width: 1200, height: 630 }],
    });
    expect(metadata.twitter).toMatchObject({ images: [{ url: SHARE_IMAGE_PATH }] });
  });

  it("uses the page's own picture and describes it", () => {
    const metadata = pageMetadata({
      ...input,
      image: "https://example.supabase.co/listing-media/a/1.webp",
      imageAlt: "Front of the house",
    });
    expect(metadata.openGraph).toMatchObject({
      images: [
        { url: "https://example.supabase.co/listing-media/a/1.webp", alt: "Front of the house" },
      ],
    });
    expect(metadata.twitter).toMatchObject({
      images: [{ url: "https://example.supabase.co/listing-media/a/1.webp" }],
    });
  });

  it("keeps an absolute title as it is and shares it without the template", () => {
    const metadata = pageMetadata({ ...input, title: { absolute: "Find Prop" } });
    expect(metadata.title).toEqual({ absolute: "Find Prop" });
    expect(metadata.openGraph).toMatchObject({ title: "Find Prop" });
  });

  it("asks that a page is neither indexed nor followed", () => {
    expect(NO_INDEX).toEqual({ robots: { index: false, follow: false } });
  });
});

describe("UT-seo: robots.txt", () => {
  it("in production lets crawlers in, shuts the private paths and names the sitemap", () => {
    const file = robotsFile({ production: true, origin: "https://findsprop.test" });
    expect(file.rules).toEqual({ userAgent: "*", allow: "/", disallow: [...DISALLOWED_PATHS] });
    expect(file.sitemap).toBe("https://findsprop.test/sitemap.xml");
  });

  it("shuts admin, builder, dashboard, the API and the pages that must not be indexed", () => {
    for (const path of [
      "/admin",
      "/builder",
      "/dashboard",
      "/post-property",
      "/auth",
      "/reset-password",
      "/compare",
      "/api",
    ]) {
      expect(DISALLOWED_PATHS).toContain(path);
    }
  });

  it("shuts the share image's path to no one", () => {
    expect(DISALLOWED_PATHS.some((path) => SHARE_IMAGE_PATH.startsWith(path))).toBe(false);
  });

  it("in any other environment asks every crawler to stay out and names no sitemap", () => {
    const file = robotsFile({ production: false, origin: "https://preview.findsprop.test" });
    expect(file.rules).toEqual({ userAgent: "*", disallow: "/" });
    expect(file.sitemap).toBeUndefined();
  });
});

describe("UT-seo: structured data", () => {
  it("leaves out what says nothing", () => {
    expect(
      compact({
        count: 1,
        nothing: null,
        missing: undefined,
        blank: "",
        none: [],
        zero: 0,
        no: false,
        some: ["x"],
      }),
    ).toEqual({ count: 1, zero: 0, no: false, some: ["x"] });
  });

  it("makes a breadcrumb trail of numbered steps with whole addresses", () => {
    expect(
      breadcrumbList([
        { name: "Home", url: "https://x.test/" },
        { name: "Properties", url: "https://x.test/properties" },
      ]),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://x.test/" },
        { "@type": "ListItem", position: 2, name: "Properties", item: "https://x.test/properties" },
      ],
    });
  });

  it("writes a place as locality and city, the state, and India: never a street", () => {
    expect(postalAddress({ locality: "Velachery", city: "Chennai", state: "Tamil Nadu" })).toEqual({
      "@type": "PostalAddress",
      addressLocality: "Velachery, Chennai",
      addressRegion: "Tamil Nadu",
      addressCountry: "IN",
    });
    expect(postalAddress({ locality: null, city: null, state: null })).toEqual({
      "@type": "PostalAddress",
      addressCountry: "IN",
    });
    expect(Object.keys(postalAddress({ locality: "OMR" }))).not.toContain("streetAddress");
  });

  it("escapes what could end or open a tag, and still reads back as the same data", () => {
    const hostile = {
      name: "</script><script>alert(1)</script> & <b>bold</b>",
      note: `line${String.fromCharCode(0x2028)}break${String.fromCharCode(0x2029)}`,
    };
    const text = serializeJsonLd(hostile);
    expect(text).not.toContain("<");
    expect(text).not.toContain(">");
    expect(text).not.toContain("&");
    expect(text).not.toContain(String.fromCharCode(0x2028));
    expect(text).not.toContain(String.fromCharCode(0x2029));
    expect(JSON.parse(text)).toEqual(hostile);
  });
});

describe("UT-seo: the JSON-LD tag", () => {
  it("is one data script that reads back as the document, whatever the text in it", () => {
    const data = { "@context": "https://schema.org", name: `5" </script> & "quoted" <x>` };
    const { container } = render(<JsonLd data={data} />);
    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.textContent).not.toContain("</script");
    expect(JSON.parse(scripts[0]?.textContent ?? "")).toEqual(data);
  });
});
