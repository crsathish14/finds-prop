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
  },
  region: {} as { name?: string },
  header: {} as { name?: string },
  aiSearch: false,
  postEnabled: true,
}));

vi.mock("@/features/site", () => ({
  getTranslate: async () => (key: string) => key,
  getSiteSettings: async () => ({
    homepage: state.homepage,
    region: state.region,
    header: state.header,
    hero: {},
  }),
  getFeatureFlags: () => ({ aiSearch: state.aiSearch, mapView: false, pgListings: false }),
  buildHero: () => ({ title: "Headline", subtitle: "Line" }),
  isRouteEnabled: () => state.postEnabled,
  resolveBrandName: () => "Find Prop",
}));
vi.mock("@/features/search", () => ({
  HomeSearch: (props: { aiSearchHref?: string }) => (
    <div data-testid="search" data-ai={props.aiSearchHref ?? ""} />
  ),
}));
vi.mock("@/features/home", () => ({
  ExploreSection: () => <section data-testid="explore" />,
  BrowseSection: (props: { regionName?: string }) => (
    <section data-testid="browse" data-region={props.regionName ?? ""} />
  ),
  WhySection: (props: { brandName: string }) => (
    <section data-testid="why" data-brand={props.brandName} />
  ),
  CtaSection: (props: { href: string }) => <section data-testid="cta" data-href={props.href} />,
}));

const { default: HomePage } = await import("../(public)/page");

const sections = () =>
  screen
    .queryAllByTestId(/^(explore|browse|why|cta)$/)
    .map((node) => node.getAttribute("data-testid"));

beforeEach(() => {
  state.homepage = {
    showFeatured: true,
    showProjectTypes: true,
    showDiscovery: true,
    showWhyUs: true,
    showCta: true,
    localities: [],
  };
  state.region = {};
  state.header = {};
  state.aiSearch = false;
  state.postEnabled = true;
});

describe("the homepage (S4-T06)", () => {
  it("shows the hero and then the sections in the order of the UX", async () => {
    render(await HomePage());
    expect(screen.getByRole("heading", { level: 1, name: "Headline" })).toBeVisible();
    expect(screen.getByTestId("search")).toBeInTheDocument();
    expect(sections()).toEqual(["explore", "browse", "why", "cta"]);
  });

  it("leaves out each section its switch in the site content turns off (BR-82)", async () => {
    state.homepage = { ...state.homepage, showDiscovery: false };
    const view = render(await HomePage());
    expect(sections()).toEqual(["browse", "why", "cta"]);
    view.unmount();
    state.homepage = { ...state.homepage, showDiscovery: true, showProjectTypes: false };
    const second = render(await HomePage());
    expect(sections()).toEqual(["explore", "why", "cta"]);
    second.unmount();
    state.homepage = { ...state.homepage, showProjectTypes: true, showWhyUs: false };
    const third = render(await HomePage());
    expect(sections()).toEqual(["explore", "browse", "cta"]);
    third.unmount();
    state.homepage = { ...state.homepage, showWhyUs: true, showCta: false };
    render(await HomePage());
    expect(sections()).toEqual(["explore", "browse", "why"]);
  });

  it("leaves out the banner when its route is switched off", async () => {
    state.postEnabled = false;
    render(await HomePage());
    expect(sections()).toEqual(["explore", "browse", "why"]);
  });

  it("gives the sections the region, the brand name and the banner's address", async () => {
    state.region = { name: "Chennai" };
    state.header = { name: "Grove Homes" };
    render(await HomePage());
    expect(screen.getByTestId("browse")).toHaveAttribute("data-region", "Chennai");
    expect(screen.getByTestId("why")).toHaveAttribute("data-brand", "Find Prop");
    expect(screen.getByTestId("cta")).toHaveAttribute("data-href", "/post-property");
  });

  it("gives the search the AI address only when AI search is on", async () => {
    const view = render(await HomePage());
    expect(screen.getByTestId("search")).toHaveAttribute("data-ai", "");
    view.unmount();
    state.aiSearch = true;
    render(await HomePage());
    expect(screen.getByTestId("search")).toHaveAttribute("data-ai", "/ai-search");
  });
});
