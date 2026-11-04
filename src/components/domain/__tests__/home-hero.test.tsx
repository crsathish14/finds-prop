// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { HomeHero } from "../home-hero";

describe("HomeHero: the top of the homepage (S4-T06)", () => {
  it("is a section named by the page's h1, with the card inside it", () => {
    renderWithMessages(
      <HomeHero title="Find the place that fits your life." subtitle="Shortlist, compare.">
        <form aria-label="Search card">fields</form>
      </HomeHero>,
    );
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Find the place that fits your life.",
    });
    const section = screen.getByRole("region", { name: "Find the place that fits your life." });
    expect(section).toContainElement(heading);
    expect(within(section).getByRole("form", { name: "Search card" })).toBeInTheDocument();
  });

  it("shows the line under the headline, and leaves it out when there is none", () => {
    const view = renderWithMessages(
      <HomeHero title="Headline" subtitle="Shortlist, compare and enquire directly.">
        <span>card</span>
      </HomeHero>,
    );
    expect(screen.getByText("Shortlist, compare and enquire directly.")).toBeVisible();
    view.unmount();
    renderWithMessages(
      <HomeHero title="Headline">
        <span>card</span>
      </HomeHero>,
    );
    expect(document.querySelector("p")).not.toBeInTheDocument();
  });

  it("sets the named part of the headline in italic copper, and the full headline is still read as one", () => {
    renderWithMessages(
      <HomeHero title="Find the place that fits your life in Chennai." emphasis="Chennai">
        <span>card</span>
      </HomeHero>,
    );
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Find the place that fits your life in Chennai.",
    });
    expect(within(heading).getByText("Chennai").tagName).toBe("EM");
  });

  it("shows the headline plain when the copper word is not part of it", () => {
    renderWithMessages(
      <HomeHero title="Homes across Tamil Nadu" emphasis="Chennai">
        <span>card</span>
      </HomeHero>,
    );
    expect(screen.getByRole("heading", { level: 1 }).querySelector("em")).not.toBeInTheDocument();
  });

  it("takes a lower heading level and its own id when it sits inside another page", () => {
    renderWithMessages(
      <HomeHero title="Inside a page" titleAs="h3" id="second-hero">
        <span>card</span>
      </HomeHero>,
    );
    const heading = screen.getByRole("heading", { level: 3, name: "Inside a page" });
    expect(heading).toHaveAttribute("id", "second-hero");
    expect(screen.getByRole("region", { name: "Inside a page" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("hides the arches from screen readers", () => {
    renderWithMessages(
      <HomeHero title="Headline">
        <span>card</span>
      </HomeHero>,
    );
    const arches = document.querySelector("[data-slot='home-hero'] > svg");
    expect(arches).toHaveAttribute("aria-hidden", "true");
    expect(arches?.querySelectorAll("path")).toHaveLength(6);
  });
});
