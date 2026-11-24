// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { DeveloperSpotlight, type DeveloperSpotlightData } from "../developer-spotlight";

const PROJECT = {
  href: "/projects/lakeview-residences",
  name: "Lakeview Residences",
  locality: "Sholinganallur, OMR",
  bedrooms: [3, 2],
  priceRupees: 7_800_000,
  priceType: "basic" as const,
  status: "new_launch" as const,
  cover: "/a.jpg",
};

const FULL: DeveloperSpotlightData = {
  name: "Sample Homes",
  logo: null,
  about: "Lake-side and garden homes across south Chennai.",
  years: 25,
  delivered: 42,
  listed: 6,
  launching: 3,
  website: "https://sample-homes.example",
  projects: [
    PROJECT,
    { ...PROJECT, href: "/projects/coastal", name: "Coastal Greens", status: "ready_to_move" },
    { ...PROJECT, href: "/projects/one", name: "Velachery One", cover: null, status: null },
    { ...PROJECT, href: "/projects/four", name: "A fourth project" },
  ],
};

const BARE: DeveloperSpotlightData = {
  name: "Solo Builder",
  logo: null,
  about: null,
  years: null,
  delivered: null,
  listed: 1,
  launching: 0,
  website: null,
  projects: [{ ...PROJECT, priceRupees: null, bedrooms: [] }],
};

const draw = (developer: DeveloperSpotlightData) =>
  renderWithMessages(
    <section aria-labelledby="spot-label spot-name">
      <DeveloperSpotlight developer={developer} headingId="spot-name" eyebrowId="spot-label" />
    </section>,
  );

describe("DeveloperSpotlight (ADR-193)", () => {
  it("says it is a sponsored developer spotlight, named by the developer", () => {
    draw(FULL);
    expect(screen.getByRole("heading", { level: 2, name: "Sample Homes" })).toBeVisible();
    expect(screen.getByRole("region")).toHaveAccessibleName(
      "Sponsored Developer spotlight Sample Homes",
    );
    expect(screen.getByText("Lake-side and garden homes across south Chennai.")).toBeVisible();
    // the initials stand in for a missing logo
    expect(screen.getByText("SH")).toBeInTheDocument();
  });

  it("shows the developer's figures, each with its label", () => {
    draw(FULL);
    const figures = screen.getAllByRole("definition").map((node) => node.textContent);
    expect(figures).toEqual(["25", "42", "6", "3"]);
    expect(screen.getAllByRole("term").map((node) => node.textContent)).toEqual([
      "Years",
      "Delivered",
      "Listed",
      "Launching",
    ]);
  });

  it("shows up to three of their projects, each one link to its page", () => {
    draw(FULL);
    const cards = screen.getAllByRole("listitem");
    expect(cards).toHaveLength(3);
    const first = within(cards[0] as HTMLElement).getByRole("link");
    expect(first).toHaveAttribute("href", "/projects/lakeview-residences");
    expect(first).toHaveTextContent("Lakeview Residences");
    expect(first).toHaveTextContent("Sholinganallur, OMR · 2, 3 BHK");
    expect(first).toHaveTextContent("basic price");
    expect(first).toHaveTextContent("New launch");
    expect(screen.getByText("Ready to move")).toBeInTheDocument();
    expect(screen.queryByText("A fourth project")).not.toBeInTheDocument();
  });

  it("links the developer's website in a new tab, marked sponsored", () => {
    draw(FULL);
    const website = screen.getByRole("link", { name: /Visit website/ });
    expect(website).toHaveAttribute("href", "https://sample-homes.example");
    expect(website).toHaveAttribute("target", "_blank");
    expect(website).toHaveAttribute("rel", "sponsored noopener");
    expect(website).toHaveAccessibleName("Visit website (opens in a new tab)");
  });

  it("leaves out what was not given, never showing it blank or as zero", () => {
    draw(BARE);
    // only the projects it lists: no years, none delivered, none launching
    expect(screen.getAllByRole("definition").map((node) => node.textContent)).toEqual(["1"]);
    expect(screen.queryByText("Launching")).not.toBeInTheDocument();
    expect(screen.queryByText("SB")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Visit website/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/BHK/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("draws an uploaded logo instead of the initials", () => {
    const { container } = draw({ ...FULL, logo: "https://example.com/logo.webp" });
    expect(container.querySelector('img[src="https://example.com/logo.webp"]')).not.toBeNull();
    expect(screen.queryByText("SH")).not.toBeInTheDocument();
  });
});
