// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { ProjectNotFound } from "../project-not-found";
import { ProjectScreen } from "../project-screen";
import { ProjectSkeleton } from "../project-skeleton";
import type { ProjectData } from "../types";

const words = en.projects.page;

const project = (overrides: Partial<ProjectData> = {}): ProjectData => ({
  id: "00000000-0000-4000-8000-000000000001",
  slug: "kadal-vista",
  name: "Kadal Vista",
  developer: { id: "b1", name: "Kadal Homes" },
  status: "under_construction",
  priceMin: 7_800_000,
  priceMax: 14_200_000,
  bhkOptions: [3, 2],
  landAreaAcres: 4.2,
  totalUnits: 320,
  possessionDate: "2028-12-31",
  contactPhone: "+914412345678",
  locality: "OMR Navalur",
  advantages: ["5 min to the IT corridor", "Near the beach road"],
  nearby: ["Navalur junction", "Shopping mall"],
  reraApplicable: true,
  reraNumber: "TN/SAMPLE/0000",
  description: "A gated community.\n\nSecond paragraph.",
  specifications: "Structure: RCC framed structure\nFlooring: Vitrified tiles",
  amenities: ["Clubhouse", "Gym", "gym"],
  images: ["a/1.webp", "a/2.webp"],
  floorPlans: ["a/plan-1.webp", "a/plan-2.webp"],
  videos: ["https://youtu.be/abc", "javascript:alert(1)"],
  brochurePath: "a/brochure.pdf",
  seoTitle: null,
  seoDescription: null,
  featured: true,
  units: [
    {
      number: "A-101",
      floor: 1,
      bhk: 2,
      areaSqft: 1050,
      facing: "East",
      price: 7_800_000,
      status: "available",
      floorPlanPath: null,
    },
    {
      number: "A-102",
      floor: 1,
      bhk: 3,
      areaSqft: 1450,
      facing: null,
      price: null,
      status: "hold",
      floorPlanPath: null,
    },
  ],
  unitCount: 320,
  availableCount: 184,
  trend: [
    { month: "2026-03-01", pricePerSqft: 7650 },
    { month: "2026-04-01", pricePerSqft: 7720 },
    { month: "2026-05-01", pricePerSqft: 7810 },
  ],
  ...overrides,
});

const sparse = (): ProjectData =>
  project({
    status: null,
    priceMin: null,
    priceMax: null,
    bhkOptions: [],
    landAreaAcres: null,
    totalUnits: null,
    possessionDate: null,
    contactPhone: null,
    advantages: [],
    nearby: [],
    reraApplicable: false,
    reraNumber: null,
    description: null,
    specifications: null,
    amenities: [],
    images: [],
    floorPlans: [],
    videos: [],
    brochurePath: null,
    featured: false,
    units: [],
    unitCount: 0,
    availableCount: 0,
    trend: [],
  });

function renderScreen(
  value: ProjectData,
  extra: Partial<Parameters<typeof ProjectScreen>[0]> = {},
) {
  return renderWithMessages(
    <ProjectScreen
      project={value}
      imageSources={value.images.map((path) => `/design-lab/listings/${path}`)}
      floorPlanSources={value.floorPlans.map((path) => `https://files.example/${path}`)}
      brochureSource="https://files.example/a/brochure.pdf"
      {...extra}
    />,
  );
}

describe("ProjectScreen: the project page (S4-T09)", () => {
  it("has the breadcrumb, the developer, the title and the tags", () => {
    renderScreen(project());
    const crumbs = screen.getByRole("navigation", { name: words.crumb.nav });
    expect(within(crumbs).getByText("Kadal Vista")).toHaveAttribute("aria-current", "page");
    for (const link of within(crumbs).getAllByRole("link", { name: words.crumb.projects })) {
      expect(link).toHaveAttribute("href", "/projects");
    }
    expect(screen.getByText("Kadal Homes")).toBeInTheDocument();
    expect(screen.getByText("KH")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Kadal Vista" })).toBeInTheDocument();
    expect(screen.getByText("OMR Navalur")).toBeInTheDocument();
    expect(screen.getByText("RERA applicable · TN/SAMPLE/0000")).toBeInTheDocument();
  });

  it("says RERA applicable alone when the project has no number", () => {
    renderScreen(project({ reraNumber: null }));
    expect(screen.getByText(words.reraTagBare)).toBeInTheDocument();
  });

  it("has no RERA tag for a project that is not under RERA", () => {
    renderScreen(project({ reraApplicable: false, reraNumber: null }));
    expect(screen.queryByText(/RERA/)).toBeNull();
  });

  it("offers Call, WhatsApp and the Brochure as links", () => {
    renderScreen(project());
    expect(screen.getByRole("link", { name: words.actions.call })).toHaveAttribute(
      "href",
      "tel:+914412345678",
    );
    const whatsapp = screen.getByRole("link", { name: new RegExp(words.actions.whatsapp) });
    expect(whatsapp).toHaveAttribute("href", "https://wa.me/914412345678");
    expect(whatsapp).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByRole("link", { name: new RegExp(words.actions.brochure) })).toHaveAttribute(
      "href",
      "https://files.example/a/brochure.pdf",
    );
  });

  it("offers Call alone for a number with no country code", () => {
    renderScreen(project({ contactPhone: "4412345678" }));
    expect(screen.getByRole("link", { name: words.actions.call })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: new RegExp(words.actions.whatsapp) })).toBeNull();
  });

  it("lists the overview facts in order, with the values in words and figures", () => {
    renderScreen(project());
    const overview = screen.getByRole("region", { name: words.overview.heading });
    for (const text of [
      words.overview.priceRange,
      "₹78 L – ₹1.42 Cr",
      "2, 3 BHK",
      "Under construction",
      "Dec 2028",
      "4.2 acres",
      "320",
      "184",
      "TN/SAMPLE/0000",
    ]) {
      expect(within(overview).getByText(text)).toBeInTheDocument();
    }
  });

  it("shows the description as paragraphs, the amenities once each, and the specifications as pairs", () => {
    renderScreen(project());
    expect(screen.getByText("A gated community.")).toBeInTheDocument();
    expect(screen.getByText("Second paragraph.")).toBeInTheDocument();
    const amenities = screen.getByRole("region", { name: words.amenities });
    expect(
      within(amenities)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Clubhouse", "Gym"]);
    const specs = screen.getByRole("region", { name: words.specifications });
    expect(within(specs).getByText("Structure")).toBeInTheDocument();
    expect(within(specs).getByText("RCC framed structure")).toBeInTheDocument();
  });

  it("draws the units table with the footer and the status as a word", () => {
    renderScreen(project());
    const table = screen.getByRole("table", { name: words.units.heading });
    expect(within(table).getByRole("columnheader", { name: words.units.unit })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "A-101" })).toBeInTheDocument();
    expect(within(table).getByText("1,050 sq.ft")).toBeInTheDocument();
    expect(within(table).getByText("Available")).toBeInTheDocument();
    expect(within(table).getByText("On hold")).toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 320 units")).toBeInTheDocument();
  });

  it("draws a dash, not a blank or a zero, for a unit detail not given", () => {
    renderScreen(project());
    const row = screen.getByRole("rowheader", { name: "A-102" }).closest("tr") as HTMLElement;
    expect(within(row).getAllByText("–")).toHaveLength(2);
  });

  it("opens each floor plan in a new tab", () => {
    renderScreen(project());
    const plans = screen.getByRole("region", { name: words.floorPlans.heading });
    const links = within(plans).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "https://files.example/a/plan-1.webp");
    expect(links[0]).toHaveAttribute("target", "_blank");
    expect(within(plans).getByText("Floor plan 1")).toBeInTheDocument();
  });

  it("draws the trend with its table, and the location and the safe videos", () => {
    renderScreen(project());
    expect(
      screen.getByRole("heading", { name: "Price per sq.ft, last 3 months" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("table", { name: words.trend.tableLabel })).toBeInTheDocument();
    const location = screen.getByRole("region", { name: words.location.heading });
    expect(within(location).getByText("Navalur junction")).toBeInTheDocument();
    expect(within(location).getByText("Near the beach road")).toBeInTheDocument();
    const videos = screen.getByRole("region", { name: words.videos.heading });
    expect(within(videos).getAllByRole("link")).toHaveLength(1);
  });

  it("puts the price, the sizes and the possession in the side card, with the badges", () => {
    renderScreen(project());
    const aside = screen.getByRole("complementary", { name: words.aside.label });
    expect(within(aside).getByText("₹78 L – ₹1.42 Cr")).toBeInTheDocument();
    expect(within(aside).getByText("2 and 3 BHK · Possession Dec 2028")).toBeInTheDocument();
    expect(within(aside).getByText(en.domain.projectCard.featured)).toBeInTheDocument();
    expect(within(aside).getByText("Under construction")).toBeInTheDocument();
  });

  it("leaves out every section the developer left empty, with no blank or zero drawn", () => {
    const { container } = renderScreen(sparse());
    expect(screen.getByRole("heading", { level: 1, name: "Kadal Vista" })).toBeInTheDocument();
    for (const heading of [
      words.overview.heading,
      words.about,
      words.amenities,
      words.specifications,
      words.units.heading,
      words.floorPlans.heading,
      words.location.heading,
      words.videos.heading,
    ]) {
      expect(screen.queryByRole("heading", { name: heading })).toBeNull();
    }
    expect(screen.queryByRole("heading", { name: /last \d+ months/ })).toBeNull();
    expect(screen.queryByRole("link", { name: words.actions.call })).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(container.querySelector("[data-slot=property-gallery]")).toBeNull();
    expect(container.textContent).not.toMatch(/₹0|\b0 acres|undefined|null/);
  });

  it("draws one price alone, not a range with equal ends", () => {
    renderScreen(project({ priceMin: 10_500_000, priceMax: 10_500_000 }));
    const aside = screen.getByRole("complementary", { name: words.aside.label });
    expect(within(aside).getByText("₹1.05 Cr")).toBeInTheDocument();
  });

  it("leaves out the trend when there is only one month", () => {
    renderScreen(project({ trend: [{ month: "2026-03-01", pricePerSqft: 7650 }] }));
    expect(screen.queryByRole("heading", { name: /last \d+ months/ })).toBeNull();
  });

  it("draws the enquiry slot beside the details, and the phone slot", () => {
    renderScreen(project(), {
      enquiry: <div data-testid="enquiry" />,
      mobileEnquiry: <div data-testid="mobile" />,
    });
    expect(
      within(screen.getByRole("complementary", { name: words.aside.label })).getByTestId("enquiry"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("mobile")).toBeInTheDocument();
  });

  it("lets the Design Lab choose the heading level", () => {
    renderScreen(project(), { titleAs: "h2" });
    expect(screen.getByRole("heading", { level: 2, name: "Kadal Vista" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });
});

describe("ProjectNotFound and ProjectSkeleton", () => {
  it("says the project was not found, with one way on", () => {
    renderWithMessages(<ProjectNotFound />);
    expect(
      screen.getByRole("heading", { level: 1, name: words.notFound.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(words.notFound.body)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: words.notFound.all })).toHaveAttribute(
      "href",
      "/projects",
    );
  });

  it("names the loading outline for a screen reader and hides its blocks", () => {
    renderWithMessages(<ProjectSkeleton />);
    const status = screen.getByRole("status", { name: words.loading });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
