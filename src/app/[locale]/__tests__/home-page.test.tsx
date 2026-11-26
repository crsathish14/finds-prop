// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
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
  /** The city the visitor chose in the header (the cookie), when a test sets one. */
  city: undefined as string | undefined,
  header: {} as { name?: string },
  aiSearch: false,
  postEnabled: true,
  layout: "search_desk" as "search_desk" | "split" | "conversational",
  eyebrow: undefined as string | undefined,
  ads: [] as unknown[],
  style: "showcase" as "showcase" | "cinematic",
  spotlight: [] as string[],
}));

vi.mock("@/features/site", async () => ({
  getTranslate: async () => (key: string) => key,
  getSiteSettings: async () => ({
    homepage: state.homepage,
    region: state.region,
    header: state.header,
    hero: { layout: state.layout, ...(state.eyebrow ? { eyebrow: state.eyebrow } : {}) },
    sponsored_builders: { featured: [], spotlight: state.spotlight },
  }),
  getSponsorAds: async () => state.ads,
  getSponsorStyle: async () => state.style,
  getFeatureFlags: () => ({ aiSearch: state.aiSearch, mapView: false, pgListings: false }),
  buildHero: (_settings: unknown, _translate: unknown, cityName?: string) => ({
    title: cityName ? `Headline in ${cityName}` : "Headline",
    subtitle: "Line",
  }),
  isRouteEnabled: () => state.postEnabled,
  resolveBrandName: () => "Find Prop",
  resolveHomeOrder: (
    (await vi.importActual("@/features/site/home-order")) as {
      resolveHomeOrder: (saved?: string[]) => string[];
    }
  ).resolveHomeOrder,
}));
vi.mock("@/features/agents", () => ({ HomeAgentsSection: () => null }));
vi.mock("@/features/search", () => ({ SEARCH_PATH: "/properties" }));
vi.mock("@/features/sponsored", () => ({
  SpotlightSection: () => <section data-testid="spotlight" />,
  trackSponsorEvent: async () => ({ ok: true }),
}));
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
vi.mock("@/components/layout/sponsor-styled-frame", () => ({
  SponsorStyledFrame: (props: { ads: { id: string }[]; style: string }) => (
    <aside
      data-testid="styled-ads"
      data-style={props.style}
      data-ids={props.ads.map((ad) => ad.id).join(",")}
    />
  ),
}));
// ConversationalLive is an async server component (its own test renders it); here it is a stand-in
// that shows what the page hands it.
vi.mock("@/features/hero-lab", () => ({
  HeroLabPreview: () => null,
  HeroLabSections: () => null,
  ConversationalLive: (props: {
    aiSearch: boolean;
    sponsor?: ReactNode;
    sponsorBare?: boolean;
    subtitle?: string;
  }) => (
    <section
      data-slot="home-hero"
      data-layout="conversational"
      data-sponsor-bare={props.sponsorBare ? "yes" : "no"}
    >
      <div data-testid="search" data-mode={props.aiSearch ? "ai" : "keyword"} />
      <p>home.hero.trust.ai</p>
      {props.sponsor}
    </section>
  ),
}));
vi.mock("@/features/home", () => ({
  ExploreSection: () => <section data-testid="explore" />,
  CityFeaturedSection: () => <section data-testid="featured" />,
  CityNewLaunchesSection: () => <section data-testid="launches" />,
  CityNewestSection: (props: { brandName: string }) => (
    <section data-testid="newest" data-brand={props.brandName} />
  ),
  // Browse by area names the city chosen in the header, or the site's region when none was chosen.
  CityBrowseSection: (props: { siteRegion?: string }) => (
    <section data-testid="browse" data-region={state.city ?? props.siteRegion ?? ""} />
  ),
  // The hero reads the city behind its own boundary; here the stand-in hands the page the chosen city,
  // or the site's region when no city is chosen (the fallback the shell holds).
  CityHero: (props: { siteRegion?: string; render: (regionName?: string) => ReactNode }) =>
    props.render(state.city ?? props.siteRegion),
  WhySection: (props: { brandName: string }) => (
    <section data-testid="why" data-brand={props.brandName} />
  ),
  CtaSection: (props: { href: string }) => <section data-testid="cta" data-href={props.href} />,
}));

const { SAMPLE_AD_A, STYLED_AD_A, STYLED_AD_B } = await import("@/lib/sponsors.fixtures");
const { default: HomePage, generateMetadata } = await import("../(public)/page");

const sections = () =>
  screen
    .queryAllByTestId(/^(explore|featured|launches|spotlight|browse|newest|why|cta)$/)
    .map((node) => node.getAttribute("data-testid"));

beforeEach(() => {
  state.style = "showcase";
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
  state.city = undefined;
  state.header = {};
  state.aiSearch = false;
  state.postEnabled = true;
  state.layout = "search_desk";
  state.eyebrow = undefined;
  state.ads = [];
  state.spotlight = [];
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

  it("shows the Developer spotlight after New launches only when the admin picked someone for it (ADR-193)", async () => {
    const view = render(await HomePage());
    expect(screen.queryByTestId("spotlight")).not.toBeInTheDocument();
    view.unmount();
    state.spotlight = ["00000000-0000-4000-b000-000000000001"];
    render(await HomePage());
    expect(sections()).toEqual([
      "explore",
      "featured",
      "launches",
      "spotlight",
      "browse",
      "newest",
      "why",
      "cta",
    ]);
  });

  it("leaves out the banner when its route is switched off", async () => {
    state.postEnabled = false;
    render(await HomePage());
    expect(sections()).toEqual(["explore", "featured", "launches", "browse", "newest", "why"]);
  });

  it("names the city the visitor chose in the hero and in Browse by area (owner, 24 Nov)", async () => {
    state.region = { name: "Chennai" };
    state.city = "Madurai";
    render(await HomePage());
    expect(screen.getByRole("heading", { level: 1, name: "Headline in Madurai" })).toBeVisible();
    expect(screen.getByTestId("browse")).toHaveAttribute("data-region", "Madurai");
  });

  it("keeps the site's region in the hero and in Browse by area when no city is chosen", async () => {
    state.region = { name: "Chennai" };
    render(await HomePage());
    expect(screen.getByRole("heading", { level: 1, name: "Headline in Chennai" })).toBeVisible();
    expect(screen.getByTestId("browse")).toHaveAttribute("data-region", "Chennai");
  });

  it("keeps the region-neutral headline when the site has no region and no city is chosen (DEC-14)", async () => {
    render(await HomePage());
    expect(screen.getByRole("heading", { level: 1, name: "Headline" })).toBeVisible();
    expect(screen.getByTestId("browse")).toHaveAttribute("data-region", "");
  });

  it("gives the sections the brand name and the banner's address", async () => {
    state.header = { name: "Grove Homes" };
    render(await HomePage());
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

  it("puts the ads ready for the chosen style under the search bar in Search Desk (ADR-190)", async () => {
    state.ads = [SAMPLE_AD_A, STYLED_AD_A, STYLED_AD_B];
    state.style = "cinematic";
    render(await HomePage());
    const styled = screen.getByTestId("styled-ads");
    expect(styled).toHaveAttribute("data-style", "cinematic");
    // the picture-only ad is not ready for a style and is left out until the admin completes it
    expect(styled).toHaveAttribute("data-ids", "styled-a,styled-b");
    expect(screen.queryByTestId("sponsor")).not.toBeInTheDocument();
    expect(screen.getByTestId("search")).toBeInTheDocument();
  });

  it("shows no ad and leaves no gap when only picture-only ads are stored (ADR-190)", async () => {
    state.ads = [SAMPLE_AD_A];
    render(await HomePage());
    expect(screen.queryByTestId("styled-ads")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sponsor")).not.toBeInTheDocument();
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
    expect(screen.getByText("home.hero.trust.ai")).toBeInTheDocument();
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
    expect(screen.queryByText("home.hero.trust.ai")).not.toBeInTheDocument();
  });
});

describe("the Conversational hero on the live homepage (ADR-177)", () => {
  it("is shown to everyone when it is chosen: the joined keyword bar, the trust lines and the styled ads", async () => {
    state.layout = "conversational";
    state.eyebrow = "Chennai · Homes, plots & new projects";
    state.ads = [STYLED_AD_A];
    render(await HomePage());
    expect(document.querySelector("[data-slot=home-hero]")).toHaveAttribute(
      "data-layout",
      "conversational",
    );
    expect(screen.getAllByTestId("search")).toHaveLength(1);
    expect(screen.getByTestId("search")).toHaveAttribute("data-mode", "keyword");
    expect(screen.getByTestId("styled-ads")).toHaveAttribute("data-style", "showcase");
    // the styled ads bring their own frame: no white box round them
    expect(document.querySelector("[data-slot=home-hero]")).toHaveAttribute(
      "data-sponsor-bare",
      "yes",
    );
    expect(screen.getByText("home.hero.trust.ai")).toBeInTheDocument();
    // the admin's eyebrow belongs to Split; the prompt pill leads here
    expect(screen.queryByText("Chennai · Homes, plots & new projects")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hero-lab")).not.toBeInTheDocument();
  });

  it("uses the AI search while FLAG_AI_SEARCH is on", async () => {
    state.layout = "conversational";
    state.aiSearch = true;
    render(await HomePage());
    expect(screen.getByTestId("search")).toHaveAttribute("data-mode", "ai");
  });

  it("leaves no ad and no gap when no ad is ready for the style, and does not fall back to Search Desk", async () => {
    state.layout = "conversational";
    state.ads = [SAMPLE_AD_A];
    render(await HomePage());
    expect(screen.queryByTestId("sponsor")).not.toBeInTheDocument();
    expect(screen.queryByTestId("styled-ads")).not.toBeInTheDocument();
    const hero = document.querySelector("[data-slot=home-hero]");
    expect(hero).toHaveAttribute("data-layout", "conversational");
    expect(hero?.querySelectorAll("aside")).toHaveLength(0);
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
