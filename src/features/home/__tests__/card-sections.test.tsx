// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import type { DeveloperRow, ListingRow } from "../schemas";

const state = vi.hoisted(() => ({
  featured: [] as unknown[],
  newest: [] as unknown[],
  developers: [] as unknown[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/saved", () => ({
  SaveHomeButton: () => (
    <button type="button" aria-pressed="false">
      Save to shortlist
    </button>
  ),
}));
vi.mock("@/lib/public-env", () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co" },
}));
vi.mock("@/features/site", () => ({
  getTranslate: async () => (key: string, values?: Record<string, string | number>) => {
    let node: unknown = messages;
    for (const part of key.split(".")) node = (node as Record<string, unknown>)[part];
    if (typeof node !== "string") throw new Error(`missing message ${key}`);
    return node.replace(/\{(\w+)\}/g, (_match, name: string) => String(values?.[name] ?? ""));
  },
}));
vi.mock("../queries", () => ({
  getFeaturedHomes: async () => state.featured,
  getNewestHomes: async () => state.newest,
  getNewLaunchDevelopers: async () => state.developers,
}));

const { FeaturedSection, NewLaunchesSection, NewestSection } = await import("../card-sections");

const home = (short_id: string, title: string): ListingRow => ({
  short_id,
  slug: `home-${short_id}`,
  listing_type: "sale",
  property_type: "apartment",
  title,
  bhk: 3,
  bathrooms: 2,
  area_sqft: 1420,
  price: 12_500_000,
  locality: "Velachery",
  city: "Chennai",
  label: "featured",
  published_at: "2026-11-01T06:00:00Z",
  cover_path: null,
  cover_alt: null,
  ageDays: 3,
});

const developer = (builderId: string, name: string): DeveloperRow => ({
  builderId,
  name,
  description: "Builds homes.",
  projectCount: 3,
  projects: [{ slug: `${builderId}-vista`, name: `${name} Vista`, coverPath: null }],
});

beforeEach(() => {
  state.featured = [];
  state.newest = [];
  state.developers = [];
});

describe("FeaturedSection: Featured homes (S4-T06)", () => {
  it("is not drawn when there are no featured homes, so no gap is left", async () => {
    expect(await FeaturedSection()).toBeNull();
  });

  it("is a region named by its heading, with a card for each home linked by its address", async () => {
    state.featured = [home("aaa11111", "First home"), home("bbb22222", "Second home")];
    renderWithMessages(<>{await FeaturedSection()}</>);
    const region = screen.getByRole("region", { name: "Featured homes" });
    expect(within(region).getByRole("link", { name: "First home" })).toHaveAttribute(
      "href",
      "/properties/home-aaa11111-aaa11111",
    );
    expect(within(region).getByRole("link", { name: "Second home" })).toBeInTheDocument();
  });

  it("has a View all link to the homes with the Featured label", async () => {
    state.featured = [home("aaa11111", "First home")];
    renderWithMessages(<>{await FeaturedSection()}</>);
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/properties?label=featured",
    );
  });

  it("draws the Save heart and the Compare checkbox on each card (S5-T01, S4-T02)", async () => {
    state.featured = [home("aaa11111", "First home")];
    renderWithMessages(<>{await FeaturedSection()}</>);
    // Save and Compare are the two controls: each a toggle that is not pressed until the visitor chooses it.
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Save to shortlist" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Compare" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

describe("NewLaunchesSection: New launches from developers (S4-T06)", () => {
  it("is not drawn when there is no developer to show", async () => {
    expect(await NewLaunchesSection()).toBeNull();
  });

  it("is a region on the darker band, with the line under the title and a card for each developer", async () => {
    state.developers = [developer("b1", "Kadal Homes"), developer("b2", "Nila Habitats")];
    renderWithMessages(<>{await NewLaunchesSection()}</>);
    const region = screen.getByRole("region", { name: "New launches from developers" });
    expect(region).toHaveAttribute("data-tone", "band");
    expect(within(region).getByText("Approved and published projects only.")).toBeVisible();
    expect(within(region).getByRole("heading", { name: "Kadal Homes" })).toBeVisible();
    expect(within(region).getByRole("heading", { name: "Nila Habitats" })).toBeVisible();
  });

  it("links each project of a developer by its slug, and has a link to all projects", async () => {
    state.developers = [developer("b1", "Kadal Homes")];
    renderWithMessages(<>{await NewLaunchesSection()}</>);
    expect(screen.getByRole("link", { name: "Kadal Homes Vista" })).toHaveAttribute(
      "href",
      "/projects/b1-vista",
    );
    expect(screen.getByRole("link", { name: "See all projects" })).toHaveAttribute(
      "href",
      "/projects",
    );
  });
});

describe("NewestSection: Newest on Find Prop (S4-T06)", () => {
  it("is not drawn when there are no homes", async () => {
    expect(await NewestSection({ brandName: "Find Prop" })).toBeNull();
  });

  it("is a region named by the brand's heading, with the homes in a list that scrolls", async () => {
    state.newest = [home("aaa11111", "First home"), home("bbb22222", "Second home")];
    renderWithMessages(<>{await NewestSection({ brandName: "Find Prop" })}</>);
    const region = screen.getByRole("region", { name: "Newest on Find Prop" });
    const list = within(region).getByRole("list", { name: "Newest homes" });
    expect(within(list).getByRole("link", { name: "First home" })).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: "Second home" })).toBeInTheDocument();
  });

  it("uses the brand name the site content gives", async () => {
    state.newest = [home("aaa11111", "First home")];
    renderWithMessages(<>{await NewestSection({ brandName: "Grove Homes" })}</>);
    expect(screen.getByRole("region", { name: "Newest on Grove Homes" })).toBeInTheDocument();
  });
});
