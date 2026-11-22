// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  homepage: {
    showFeatured: true,
    showProjectTypes: true,
    showDiscovery: true,
    showWhyUs: true,
    showCta: true,
    localities: [] as unknown[],
    order: undefined as string[] | undefined,
  },
  region: {} as { name?: string },
  header: {} as { name?: string },
  aiSearch: false,
  postEnabled: true,
  layout: "search_desk" as "search_desk" | "split",
  eyebrow: undefined as string | undefined,
  ads: [] as unknown[],
}));

vi.mock("@/features/site", async () => ({
  getTranslate: async () => (key: string) => key,
  getSiteSettings: async () => ({
    homepage: state.homepage,
    region: state.region,
    header: state.header,
    hero: { layout: state.layout, ...(state.eyebrow ? { eyebrow: state.eyebrow } : {}) },
  }),
  getSponsorAds: async () => state.ads,
  getFeatureFlags: () => ({ aiSearch: state.aiSearch, mapView: false, pgListings: false }),
  buildHero: () => ({ title: "Headline", subtitle: "Line" }),
  isRouteEnabled: () => state.postEnabled,
  resolveBrandName: () => "Find Prop",
  resolveHomeOrder: (
    (await vi.importActual("@/features/site/home-order")) as {
      resolveHomeOrder: (saved?: string[]) => string[];
    }
  ).resolveHomeOrder,
}));
vi.mock("@/features/search", () => ({ SEARCH_PATH: "/properties" }));
vi.mock("@/features/ai-chat", () => ({
  HomeAiSearch: () => <div data-testid="search" data-mode="ai" />,
}));
vi.mock("@/components/domain/home-search-bar.client", () => ({
  HomeSearchBar: (props: { mode: string; action: string }) => (
    <div data-testid="search" data-mode={props.mode} data-action={props.action} />
  ),
}));
vi.mock("@/components/layout/sponsor-slot", () => ({
  SponsorSlot: (props: { layout?: string; placement: string }) => (
    <aside
      data-testid="sponsor"
      data-layout={props.layout ?? ""}
      data-placement={props.placement}
    />
  ),
}));
vi.mock("@/features/home", () => ({
  ExploreSection: () => <section data-testid="explore" />,
  CityFeaturedSection: () => <section data-testid="featured" />,
  NewLaunchesSection: () => <section data-testid="launches" />,
  CityNewestSection: (props: { brandName: string }) => (
    <section data-testid="newest" data-brand={props.brandName} />
  ),
  BrowseSection: (props: { regionName?: string }) => (
    <section data-testid="browse" data-region={props.regionName ?? ""} />
  ),
  WhySection: (props: { brandName: string }) => (
    <section data-testid="why" data-brand={props.brandName} />
  ),
  CtaSection: (props: { href: string }) => <section data-testid="cta" data-href={props.href} />,
}));

const { SAMPLE_AD_A } = await import("@/lib/sponsors.fixtures");
const { default: HomePage, generateMetadata } = await import("../(public)/page");

const sections = () =>
  screen
    .queryAllByTestId(/^(explore|featured|launches|browse|newest|why|cta)$/)
    .map((node) => node.getAttribute("data-testid"));

beforeEach(() => {
  state.homepage = {
    showFeatured: true,
    showProjectTypes: true,
    showDiscovery: true,
    showWhyUs: true,
    showCta: true,
    localities: [],
    order: undefined,
  };
  state.region = {};
  state.header = {};
  state.aiSearch = false;
  state.postEnabled = true;
  state.layout = "search_desk";
  state.eyebrow = undefined;
  state.ads = [];
});

describe("the homepage (S4-T06)", () => {
  it("shows the hero and then the sections in the order of the UX", async () => {
    render(await HomePage());
    expect(screen.getByRole("heading", { level: 1, name: "Headline" })).toBeVisible();
    expect(screen.getByTestId("search")).toBeInTheDocument();
    expect(sections()).toEqual([
      "explore",
      "featured",
      "launches",
      "browse",
      "newest",
      "why",
      "cta",
    ]);
  });

  it("leaves out each section its switch in the site content turns off (BR-82)", async () => {
    const off = async (change: Partial<typeof state.homepage>) => {
      state.homepage = { ...state.homepage, ...change };
      const view = render(await HomePage());
      const shown = sections();
      view.unmount();
      state.homepage = {
        showFeatured: true,
        showProjectTypes: true,
        showDiscovery: true,
        showWhyUs: true,
        showCta: true,
        localities: [],
        order: undefined,
      };
      return shown;
    };
    expect(await off({ showDiscovery: false })).toEqual([
      "featured",
      "launches",
      "browse",
      "newest",
      "why",
      "cta",
    ]);
    expect(await off({ showFeatured: false })).toEqual([
      "explore",
      "launches",
      "browse",
      "newest",
      "why",
      "cta",
    ]);
    expect(await off({ showProjectTypes: false })).toEqual([
      "explore",
      "featured",
      "launches",
      "newest",
      "why",
      "cta",
    ]);
    expect(await off({ showWhyUs: false })).toEqual([
      "explore",
      "featured",
      "launches",
      "browse",
      "newest",
      "cta",
    ]);
    expect(await off({ showCta: false })).toEqual([
      "explore",
      "featured",
      "launches",
      "browse",
      "newest",
      "why",
    ]);
  });

  it("always asks for New launches and Newest, which have no switch and leave themselves out when empty", async () => {
    state.homepage = {
      ...state.homepage,
      showDiscovery: false,
      showFeatured: false,
      showProjectTypes: false,
      showWhyUs: false,
      showCta: false,
    };
    render(await HomePage());
    expect(sections()).toEqual(["launches", "newest"]);
  });

  it("shows the sections in the order the super admin chose, once for every screen width, and hidden ones stay hidden", async () => {
    state.homepage = {
      ...state.homepage,
      showFeatured: false,
      order: ["cta", "whyUs", "bogus", "cta", "newest"],
    };
    render(await HomePage());
    expect(sections()).toEqual(["cta", "why", "newest", "explore", "launches", "browse"]);
  });

  it("leaves out the banner when its route is switched off", async () => {
    state.postEnabled = false;
    render(await HomePage());
    expect(sections()).toEqual(["explore", "featured", "launches", "browse", "newest", "why"]);
  });

  it("gives the sections the region, the brand name and the banner's address", async () => {
    state.region = { name: "Chennai" };
    state.header = { name: "Grove Homes" };
    render(await HomePage());
    expect(screen.getByTestId("browse")).toHaveAttribute("data-region", "Chennai");
    expect(screen.getByTestId("why")).toHaveAttribute("data-brand", "Find Prop");
    expect(screen.getByTestId("newest")).toHaveAttribute("data-brand", "Find Prop");
    expect(screen.getByTestId("cta")).toHaveAttribute("data-href", "/post-property");
  });

  it("draws the AI search bar while AI search is on, and a keyword search of the results otherwise (ADR-150)", async () => {
    const view = render(await HomePage());
    expect(screen.getByTestId("search")).toHaveAttribute("data-mode", "keyword");
    expect(screen.getByTestId("search")).toHaveAttribute("data-action", "/properties");
    view.unmount();
    state.aiSearch = true;
    render(await HomePage());
    expect(screen.getAllByTestId("search")).toHaveLength(1);
    expect(screen.getByTestId("search")).toHaveAttribute("data-mode", "ai");
  });
});

describe("the homepage banner area (S4-T07)", () => {
  it("shows no banner and leaves no gap when no banner is stored", async () => {
    render(await HomePage());
    expect(screen.queryByTestId("sponsor")).not.toBeInTheDocument();
    expect(screen.getByTestId("search")).toBeInTheDocument();
    expect(document.querySelector("[data-slot=home-hero]")).toHaveAttribute(
      "data-layout",
      "search_desk",
    );
  });

  it("puts the strip under the search bar in Search Desk when a banner qualifies", async () => {
    state.ads = [SAMPLE_AD_A];
    render(await HomePage());
    expect(screen.getByTestId("sponsor")).toHaveAttribute("data-layout", "search_desk");
    expect(screen.getByTestId("sponsor")).toHaveAttribute("data-placement", "hero");
    expect(screen.getByTestId("search")).toBeInTheDocument();
  });

  it("is Split, with the search bar, the panel, the trust lines and the eyebrow, when Split is chosen and a panel banner qualifies", async () => {
    state.layout = "split";
    state.eyebrow = "  Chennai · Homes, plots & new projects  ";
    state.ads = [SAMPLE_AD_A];
    render(await HomePage());
    expect(document.querySelector("[data-slot=home-hero]")).toHaveAttribute("data-layout", "split");
    expect(screen.getByTestId("search")).toBeInTheDocument();
    expect(screen.getByTestId("sponsor")).toHaveAttribute("data-layout", "split");
    expect(screen.getByText("Chennai · Homes, plots & new projects")).toBeInTheDocument();
    expect(screen.getByText("home.hero.trust.compare")).toBeInTheDocument();
  });

  it("falls back to Search Desk with nothing in the banner position when Split is chosen but no panel banner qualifies", async () => {
    state.layout = "split";
    state.eyebrow = "Chennai · Homes, plots & new projects";
    state.ads = [];
    render(await HomePage());
    expect(document.querySelector("[data-slot=home-hero]")).toHaveAttribute(
      "data-layout",
      "search_desk",
    );
    expect(screen.queryByTestId("sponsor")).not.toBeInTheDocument();
    expect(screen.getByTestId("search")).toBeInTheDocument();
    // the eyebrow and the trust lines belong to Split only
    expect(screen.queryByText("Chennai · Homes, plots & new projects")).not.toBeInTheDocument();
    expect(screen.queryByText("home.hero.trust.compare")).not.toBeInTheDocument();
  });
});

describe("the homepage's metadata (FR-PUB-14)", () => {
  it("is titled by the site name alone, describes the site and has the root as its canonical address", async () => {
    const metadata = await generateMetadata();
    expect(metadata.title).toEqual({ absolute: "meta.title" });
    expect(metadata.description).toBe("meta.description");
    expect(metadata.alternates?.canonical).toBe("/");
    expect(metadata.openGraph).toMatchObject({
      url: "/",
      siteName: "meta.title",
      images: [{ url: "/share-image.png" }],
    });
  });
});
