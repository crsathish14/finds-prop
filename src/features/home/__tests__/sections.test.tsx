// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import messages from "@/i18n/messages/en.json";

vi.mock("server-only", () => ({}));
vi.mock("@/features/site", () => ({
  getTranslate: async () => (key: string, values?: Record<string, string | number>) => {
    let node: unknown = messages;
    for (const part of key.split(".")) node = (node as Record<string, unknown>)[part];
    if (typeof node !== "string") throw new Error(`missing message ${key}`);
    return node.replace(/\{(\w+)\}/g, (_match, name: string) => String(values?.[name] ?? ""));
  },
}));

const { BrowseSection, CtaSection, ExploreSection, WhySection } = await import("../sections");

const CURATED = [
  { label: "Adyar", lat: 13.0012, lng: 80.2565, radiusKm: 3 },
  { label: "Anna Nagar", lat: 13.085, lng: 80.2101, radiusKm: 4 },
];

describe("ExploreSection: Explore by locality (S4-T06)", () => {
  it("is a region named by its heading, with a tile for each curated locality", async () => {
    render(await ExploreSection({ localities: CURATED }));
    const region = screen.getByRole("region", { name: "Explore by locality" });
    expect(within(region).getByRole("link", { name: "Adyar" })).toHaveAttribute(
      "href",
      "/properties?lat=13.0012&lng=80.2565&place=Adyar&r=3",
    );
    expect(within(region).getByRole("link", { name: "Anna Nagar" })).toBeInTheDocument();
  });

  it("has a link to all localities, which is the results page", async () => {
    render(await ExploreSection({ localities: CURATED }));
    expect(screen.getByRole("link", { name: "See all localities" })).toHaveAttribute(
      "href",
      "/properties",
    );
  });

  it("is not drawn at all when no locality is curated, so no gap is left", async () => {
    const element = await ExploreSection({ localities: [] });
    expect(element).toBeNull();
  });
});

describe("BrowseSection: Browse by what matters (S4-T06)", () => {
  it("is a region with the four cards as links", async () => {
    render(await BrowseSection({}));
    const region = screen.getByRole("region", { name: "Browse by what matters" });
    const hrefs = within(region)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      "/properties?label=featured",
      "/properties?label=prime",
      "/properties?label=budget",
      "/properties",
    ]);
  });

  it("names the region in the By locality line only when it is given", async () => {
    const view = render(await BrowseSection({}));
    expect(screen.getByText("Browse homes area by area")).toBeInTheDocument();
    view.unmount();
    render(await BrowseSection({ regionName: "Chennai" }));
    expect(screen.getByText("Browse homes area by area across Chennai")).toBeInTheDocument();
  });
});

describe("WhySection: Why Find Prop (S4-T06)", () => {
  it("has the brand name in the heading and in the first reason", async () => {
    render(await WhySection({ brandName: "Find Prop" }));
    const region = screen.getByRole("region", { name: "Why Find Prop" });
    expect(within(region).getByRole("heading", { level: 2, name: "Why Find Prop" })).toBeVisible();
    expect(
      within(region).getByText("Homes appear on Find Prop after they are approved."),
    ).toBeVisible();
    expect(within(region).getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });
});

describe("CtaSection: the post-a-property banner (S4-T06)", () => {
  it("is a region named by the banner's title, with a link to where it is given", async () => {
    render(await CtaSection({ href: "/post-property" }));
    const region = screen.getByRole("region", { name: "Want to sell or rent your property?" });
    expect(within(region).getByRole("link", { name: "Post your property free" })).toHaveAttribute(
      "href",
      "/post-property",
    );
  });
});
