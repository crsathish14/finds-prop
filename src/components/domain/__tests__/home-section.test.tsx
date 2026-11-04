// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeSection } from "../home-section";
import { SectionGrid } from "../section-grid";

describe("HomeSection: one band of the homepage (S4-T06)", () => {
  it("is a region named by its heading", () => {
    render(
      <HomeSection labelledBy="explore-title">
        <h2 id="explore-title">Explore by locality</h2>
      </HomeSection>,
    );
    expect(screen.getByRole("region", { name: "Explore by locality" })).toBeInTheDocument();
  });

  it("has the page's spacing by default and the tighter spacing when asked", () => {
    const view = render(
      <HomeSection labelledBy="a">
        <h2 id="a">A</h2>
      </HomeSection>,
    );
    expect(screen.getByRole("region").className).toContain("py-section");
    view.unmount();
    render(
      <HomeSection labelledBy="b" spacing="tight">
        <h2 id="b">B</h2>
      </HomeSection>,
    );
    const tight = screen.getByRole("region");
    expect(tight.className).toContain("py-6");
    expect(tight.className).not.toContain("py-section");
  });

  it("is the page colour by default and the darker band when asked", () => {
    const view = render(
      <HomeSection labelledBy="a">
        <h2 id="a">A</h2>
      </HomeSection>,
    );
    expect(screen.getByRole("region").className).not.toContain("bg-canvas-sunken");
    view.unmount();
    render(
      <HomeSection labelledBy="b" tone="band">
        <h2 id="b">B</h2>
      </HomeSection>,
    );
    expect(screen.getByRole("region").className).toContain("bg-canvas-sunken");
  });

  it("keeps its content inside the page container", () => {
    render(
      <HomeSection labelledBy="a">
        <h2 id="a">A</h2>
      </HomeSection>,
    );
    expect(screen.getByRole("heading").parentElement?.className).toContain("px-gutter");
  });
});

describe("SectionGrid: the columns of a homepage card row (S4-T06)", () => {
  const classes = (variant: "tiles" | "categories" | "values") => {
    const view = render(
      <SectionGrid variant={variant}>
        <span>card</span>
      </SectionGrid>,
    );
    const className = view.container.firstElementChild?.className ?? "";
    view.unmount();
    return className;
  };

  it("lays tiles out 2, 3 and 5 across", () => {
    const tiles = classes("tiles");
    expect(tiles).toContain("grid-cols-2");
    expect(tiles).toContain("md:grid-cols-3");
    expect(tiles).toContain("portal:grid-cols-5");
  });

  it("lays category cards out 1, 2 and 4 across", () => {
    const categories = classes("categories");
    expect(categories.split(" ")).not.toContain("grid-cols-2");
    expect(categories).toContain("md:grid-cols-2");
    expect(categories).toContain("portal:grid-cols-4");
  });

  it("lays value cards out 1 and 3 across", () => {
    const values = classes("values");
    expect(values).toContain("md:grid-cols-3");
    expect(values).not.toContain("portal:grid-cols");
  });
});
