// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { ProjectCard, ProjectCardSkeleton, type ProjectCardData } from "../project-card";

const project: ProjectCardData = {
  href: "/projects/kadal-vista",
  name: "Kadal Vista",
  developerName: "Kadal Homes",
  locality: "OMR Navalur",
  city: "Chennai",
  priceRupees: 78_00_000,
  priceType: "basic",
  bedrooms: [3, 2, 3],
  status: "under_construction",
  featured: true,
  cover: { src: "/design-lab/listings/home-a.svg", alt: "A drawn tower" },
};

const words = en.domain.projectCard;

describe("ProjectCard: one project in a grid (S4-T01)", () => {
  it("shows the developer, name, place, price with what it means, BHK sizes and the two badges", () => {
    renderWithMessages(<ProjectCard project={project} />);
    expect(screen.getByText("Kadal Homes")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Kadal Vista" })).toBeInTheDocument();
    expect(screen.getByText("OMR Navalur, Chennai")).toBeInTheDocument();
    expect(screen.getByText("₹78 L basic price")).toBeInTheDocument();
    expect(screen.getByText(words.featured)).toBeInTheDocument();
    expect(screen.getByText(words.status.underConstruction)).toBeInTheDocument();
  });

  it("shows the Prime badge only for a Prime project (ADR-208)", () => {
    const { unmount } = renderWithMessages(<ProjectCard project={{ ...project, prime: true }} />);
    expect(screen.getByText(words.prime)).toBeInTheDocument();
    unmount();
    renderWithMessages(<ProjectCard project={project} />);
    expect(screen.queryByText(words.prime)).not.toBeInTheDocument();
  });

  it("shows the locality alone when the project has no city", () => {
    renderWithMessages(<ProjectCard project={{ ...project, city: "" }} />);
    expect(screen.getByText("OMR Navalur")).toBeInTheDocument();
    expect(screen.queryByText(/OMR Navalur,/)).toBeNull();
  });

  it("lists each BHK size once, smallest first", () => {
    renderWithMessages(<ProjectCard project={project} />);
    const sizes = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(sizes.map((item) => item.textContent)).toEqual(["2 BHK", "3 BHK"]);
  });

  it("is one link target: the name link goes to the project, and the picture has its alt text", () => {
    renderWithMessages(<ProjectCard project={project} />);
    const link = screen.getByRole("link", { name: "Kadal Vista" });
    expect(link).toHaveAttribute("href", project.href);
    expect(link).toHaveAttribute("data-stretched");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByAltText("A drawn tower")).toBeInTheDocument();
  });

  it("says the status in words for each of the three statuses", () => {
    const labels = {
      new_launch: words.status.newLaunch,
      under_construction: words.status.underConstruction,
      ready_to_move: words.status.readyToMove,
    } as const;
    for (const [status, label] of Object.entries(labels)) {
      const view = renderWithMessages(
        <ProjectCard project={{ ...project, status: status as keyof typeof labels }} />,
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      view.unmount();
    }
  });

  it.each([
    ["per_sqft", 8_500, "₹8,500 per sq ft"],
    ["basic", 78_00_000, "₹78 L basic price"],
    ["all_inclusive", 1_42_00_000, "₹1.42 Cr all inclusive"],
    ["rent_per_month", 45_000, "₹45,000 per month"],
    ["rent_per_sqft_month", 85, "₹85 per sq ft per month"],
  ] as const)("says what a %s price means", (priceType, priceRupees, text) => {
    renderWithMessages(<ProjectCard project={{ ...project, priceType, priceRupees }} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("shows a price with no known type alone", () => {
    renderWithMessages(<ProjectCard project={{ ...project, priceType: null }} />);
    expect(screen.getByText("₹78 L")).toBeInTheDocument();
  });

  it("shows a For sale or For rent badge for a commercial project, and none otherwise", () => {
    const sale = renderWithMessages(<ProjectCard project={{ ...project, offerType: "sale" }} />);
    expect(screen.getByText(words.offer.sale)).toBeInTheDocument();
    sale.unmount();
    const rent = renderWithMessages(<ProjectCard project={{ ...project, offerType: "rent" }} />);
    expect(screen.getByText(words.offer.rent)).toBeInTheDocument();
    rent.unmount();
    renderWithMessages(<ProjectCard project={project} />);
    expect(screen.queryByText(words.offer.sale)).toBeNull();
    expect(screen.queryByText(words.offer.rent)).toBeNull();
  });

  it("leaves out what is missing, never showing blanks or zeros", () => {
    renderWithMessages(
      <ProjectCard
        project={{
          href: "/projects/x",
          name: "Quiet Court",
          locality: "Porur",
          city: "Chennai",
          priceRupees: 0,
          bedrooms: [],
          cover: null,
        }}
      />,
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText(/₹/)).not.toBeInTheDocument();
    expect(screen.queryByText(words.featured)).not.toBeInTheDocument();
    expect(document.querySelector("[data-slot=badge]")).not.toBeInTheDocument();
    expect(document.querySelector("[data-slot=card-cover-fallback]")).toBeInTheDocument();
  });

  it("swaps to the illustrated tile when the picture fails to load", () => {
    renderWithMessages(<ProjectCard project={project} />);
    fireEvent.error(screen.getByAltText("A drawn tower"));
    expect(document.querySelector("[data-slot=card-cover-fallback]")).toBeInTheDocument();
  });

  it("gives the name link the display weight, not the link's own semibold", () => {
    renderWithMessages(<ProjectCard project={project} />);
    const link = screen.getByRole("link", { name: "Kadal Vista" });
    expect(link.className).not.toContain("font-semibold");
  });
});

describe("ProjectCard, compact layout (the AI chat's cards page)", () => {
  it("shows the price, name, BHK sizes and locality, and leaves out the developer and the city", () => {
    renderWithMessages(<ProjectCard project={project} layout="compact" />);
    expect(document.querySelector("[data-slot=project-card]")).toHaveAttribute(
      "data-layout",
      "compact",
    );
    expect(screen.getByText("₹78 L basic price")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Kadal Vista" })).toBeInTheDocument();
    const sizes = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(sizes.map((item) => item.textContent)).toEqual(["2 BHK", "3 BHK"]);
    expect(screen.getByText("OMR Navalur")).toBeInTheDocument();
    expect(screen.queryByText("Kadal Homes")).not.toBeInTheDocument();
    expect(screen.queryByText("OMR Navalur, Chennai")).not.toBeInTheDocument();
  });

  it("shows one badge, the strongest of Featured, Prime, the status and the offer", () => {
    const badges = () =>
      [...document.querySelectorAll("[data-slot=badge]")].map((badge) => badge.textContent);
    const first = renderWithMessages(
      <ProjectCard project={{ ...project, prime: true }} layout="compact" />,
    );
    expect(badges()).toEqual([words.featured]);
    first.unmount();
    const second = renderWithMessages(
      <ProjectCard project={{ ...project, featured: false, prime: true }} layout="compact" />,
    );
    expect(badges()).toEqual([words.prime]);
    second.unmount();
    const third = renderWithMessages(
      <ProjectCard project={{ ...project, featured: false }} layout="compact" />,
    );
    expect(badges()).toEqual([words.status.underConstruction]);
    third.unmount();
    const fourth = renderWithMessages(
      <ProjectCard
        project={{ ...project, featured: false, status: null, offerType: "rent" }}
        layout="compact"
      />,
    );
    expect(badges()).toEqual([words.offer.rent]);
    fourth.unmount();
    renderWithMessages(
      <ProjectCard project={{ ...project, featured: false, status: null }} layout="compact" />,
    );
    expect(badges()).toEqual([]);
  });

  it("is one link target and handles a project with nothing but its name and place", () => {
    renderWithMessages(
      <ProjectCard
        project={{ href: "/projects/x", name: "Details to follow", locality: "Madurai", city: "" }}
        layout="compact"
      />,
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText(/₹/)).not.toBeInTheDocument();
    expect(document.querySelector("[data-slot=card-cover-fallback]")).toBeInTheDocument();
  });
});

describe("ProjectCardSkeleton", () => {
  it("is hidden from screen readers and holds the card's box", () => {
    const { container } = renderWithMessages(<ProjectCardSkeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(container.querySelector(".aspect-16\\/10")).toBeInTheDocument();
  });
});

describe("ProjectCardSkeleton, compact", () => {
  it("is hidden from screen readers and holds the compact card's box", () => {
    const { container } = renderWithMessages(<ProjectCardSkeleton layout="compact" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstElementChild).toHaveAttribute("data-layout", "compact");
    expect(container.querySelector(".aspect-16\\/10")).not.toBeInTheDocument();
  });
});
