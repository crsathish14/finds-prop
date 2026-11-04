// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import {
  DeveloperCard,
  DeveloperCardSkeleton,
  monogramOf,
  type DeveloperCardData,
} from "../developer-card";

const developer: DeveloperCardData = {
  name: "Kadal Homes",
  monogram: "KH",
  tint: "green",
  projectCount: 4,
  about: "Mid-rise apartment communities along the OMR corridor.",
  projects: [
    {
      href: "/projects/kadal-vista",
      name: "Kadal Vista",
      cover: "/design-lab/listings/home-a.svg",
    },
    {
      href: "/projects/kadal-courts",
      name: "Kadal Courts",
      cover: "/design-lab/listings/home-b.svg",
    },
    { href: "/projects/third", name: "A third one", cover: null },
  ],
};

describe("DeveloperCard: one developer and two of their projects (S4-T01)", () => {
  it("shows the name, the project count, the introduction and the monogram", () => {
    renderWithMessages(<DeveloperCard developer={developer} />);
    expect(screen.getByRole("heading", { level: 3, name: "Kadal Homes" })).toBeInTheDocument();
    expect(screen.getByText("4 projects")).toBeInTheDocument();
    expect(screen.getByText(developer.about as string)).toBeInTheDocument();
    expect(document.querySelector("[data-slot=developer-card-monogram]")).toHaveTextContent("KH");
  });

  it("says '1 project' for one", () => {
    renderWithMessages(<DeveloperCard developer={{ ...developer, projectCount: 1 }} />);
    expect(screen.getByText("1 project")).toBeInTheDocument();
  });

  it("shows only the first two projects, each a link named by the project", () => {
    renderWithMessages(<DeveloperCard developer={developer} />);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/projects/kadal-vista",
      "/projects/kadal-courts",
    ]);
    expect(screen.getByRole("link", { name: "Kadal Vista" })).toBeInTheDocument();
    expect(screen.queryByText("A third one")).not.toBeInTheDocument();
  });

  it("gives the thumbnail pictures empty alt text, because the name beside them says it", () => {
    renderWithMessages(<DeveloperCard developer={developer} />);
    const pictures = document.querySelectorAll("a img");
    expect(pictures.length).toBeGreaterThan(0);
    for (const picture of pictures) expect(picture).toHaveAttribute("alt", "");
  });

  it("draws the illustrated tile for a picture that is missing or fails to load", () => {
    renderWithMessages(
      <DeveloperCard
        developer={{
          ...developer,
          projects: [
            { href: "/projects/a", name: "No picture", cover: null },
            { href: "/projects/b", name: "Broken", cover: "/design-lab/listings/home-a.svg" },
          ],
        }}
      />,
    );
    expect(document.querySelectorAll("[data-slot=card-cover-fallback]")).toHaveLength(1);
    fireEvent.error(document.querySelector("a img") as HTMLElement);
    expect(document.querySelectorAll("[data-slot=card-cover-fallback]")).toHaveLength(2);
  });

  it("leaves out the count, the introduction and the thumbnails when they are missing", () => {
    renderWithMessages(
      <DeveloperCard developer={{ name: "Thendral Estates", projectCount: 0, projects: [] }} />,
    );
    expect(screen.queryByText(/project/)).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(document.querySelector("[data-slot=developer-card-monogram]")).toHaveTextContent("TE");
  });

  it("tints the monogram green, copper or sand", () => {
    const classes = (tint: "green" | "copper" | "sand") => {
      const view = renderWithMessages(<DeveloperCard developer={{ ...developer, tint }} />);
      const className = document.querySelector("[data-slot=developer-card-monogram]")?.className;
      view.unmount();
      return className;
    };
    expect(classes("green")).toContain("bg-primary-tint");
    expect(classes("copper")).toContain("bg-cta-tint");
    expect(classes("sand")).toContain("bg-neutral-tint");
  });
});

describe("monogramOf", () => {
  it("takes the first letters of the first two words", () => {
    expect(monogramOf("Kadal Homes")).toBe("KH");
    expect(monogramOf("Arivu Constructions Private Limited")).toBe("AC");
    expect(monogramOf("  nila   habitats ")).toBe("NH");
  });

  it("gives one letter for one word and nothing for an empty name", () => {
    expect(monogramOf("Thendral")).toBe("T");
    expect(monogramOf("")).toBe("");
  });
});

describe("DeveloperCardSkeleton", () => {
  it("is hidden from screen readers and shows no text", () => {
    const { container } = renderWithMessages(<DeveloperCardSkeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
