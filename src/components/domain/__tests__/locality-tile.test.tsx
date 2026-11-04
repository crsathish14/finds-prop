// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { LocalityTile, LocalityTileSkeleton, tintAt } from "../locality-tile";

describe("LocalityTile: a tile that links to one locality (S4-T01)", () => {
  it("is one link, named by the locality and its subtitle", () => {
    renderWithMessages(
      <LocalityTile
        name="Adyar"
        href="/properties?locality=adyar"
        subtitle="Apartments · Villas"
      />,
    );
    const link = screen.getByRole("link", { name: "Adyar Apartments · Villas" });
    expect(link).toHaveAttribute("href", "/properties?locality=adyar");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("leaves out the subtitle when there is none", () => {
    renderWithMessages(<LocalityTile name="Porur" href="/properties" />);
    expect(screen.getByRole("link", { name: "Porur" })).toBeInTheDocument();
    expect(document.querySelector("small")).not.toBeInTheDocument();
  });

  it("hides the arch drawing from screen readers", () => {
    renderWithMessages(<LocalityTile name="Adyar" href="/properties" />);
    expect(document.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses a different surface for each of the five tints, and a copper arch on the even ones", () => {
    const surface = (tint: 1 | 2 | 3 | 4 | 5) => {
      const view = renderWithMessages(<LocalityTile name="X" href="/x" tint={tint} />);
      const className = screen.getByRole("link").className;
      view.unmount();
      return className;
    };
    expect(surface(1)).toContain("from-primary-tint");
    expect(surface(2)).toContain("from-cta-tint");
    expect(surface(2)).toContain("text-cta-text");
    expect(surface(3)).toContain("to-line");
    expect(surface(4)).toContain("text-cta-text");
    expect(surface(5)).toContain("to-neutral-tint");
  });
});

describe("tintAt", () => {
  it("counts 1 to 5 and then starts again", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(tintAt)).toEqual([1, 2, 3, 4, 5, 1, 2]);
  });

  it("stays in range for a negative place", () => {
    expect(tintAt(-1)).toBe(5);
  });
});

describe("LocalityTileSkeleton", () => {
  it("is hidden from screen readers and holds the tile's box", () => {
    renderWithMessages(<LocalityTileSkeleton />);
    const skeleton = document.querySelector("[data-slot=locality-tile-skeleton]");
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    expect(skeleton?.className).toContain("h-37.5");
  });
});
