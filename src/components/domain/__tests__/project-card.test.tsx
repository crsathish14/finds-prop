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
  minRupees: 78_00_000,
  maxRupees: 1_42_00_000,
  bedrooms: [3, 2, 3],
  status: "under_construction",
  featured: true,
  cover: { src: "/design-lab/listings/home-a.svg", alt: "A drawn tower" },
};

const words = en.domain.projectCard;

describe("ProjectCard: one project in a grid (S4-T01)", () => {
  it("shows the developer, name, place, price range, BHK sizes and the two badges", () => {
    renderWithMessages(<ProjectCard project={project} />);
    expect(screen.getByText("Kadal Homes")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Kadal Vista" })).toBeInTheDocument();
    expect(screen.getByText("OMR Navalur, Chennai")).toBeInTheDocument();
    expect(screen.getByText("₹78 L – ₹1.42 Cr")).toBeInTheDocument();
    expect(screen.getByText(words.featured)).toBeInTheDocument();
    expect(screen.getByText(words.status.underConstruction)).toBeInTheDocument();
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

  it("shows one price alone when there is no second price or both are the same", () => {
    const alone = renderWithMessages(<ProjectCard project={{ ...project, maxRupees: null }} />);
    expect(screen.getByText("₹78 L")).toBeInTheDocument();
    alone.unmount();
    renderWithMessages(<ProjectCard project={{ ...project, maxRupees: project.minRupees }} />);
    expect(screen.getByText("₹78 L")).toBeInTheDocument();
  });

  it("leaves out what is missing, never showing blanks or zeros", () => {
    renderWithMessages(
      <ProjectCard
        project={{
          href: "/projects/x",
          name: "Quiet Court",
          locality: "Porur",
          city: "Chennai",
          minRupees: 0,
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

describe("ProjectCardSkeleton", () => {
  it("is hidden from screen readers and holds the card's box", () => {
    const { container } = renderWithMessages(<ProjectCardSkeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(container.querySelector(".aspect-16\\/10")).toBeInTheDocument();
  });
});
