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

describe("HomeHero: the sponsored banner and the Split layout (S4-T07)", () => {
  it("puts the banner area under the search card in Search Desk, and leaves no gap without one", () => {
    const view = renderWithMessages(
      <HomeHero title="Headline" sponsor={<aside aria-label="Sponsored strip">strip</aside>}>
        <form aria-label="Search card">card</form>
      </HomeHero>,
    );
    const section = screen.getByRole("region", { name: "Headline" });
    expect(section).toHaveAttribute("data-layout", "search_desk");
    const card = within(section).getByRole("form", { name: "Search card" });
    const strip = within(section).getByLabelText("Sponsored strip");
    expect(card.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    view.unmount();
    renderWithMessages(
      <HomeHero title="Headline">
        <form aria-label="Search card">card</form>
      </HomeHero>,
    );
    const bare = screen.getByRole("region", { name: "Headline" });
    expect(bare.querySelectorAll("aside")).toHaveLength(0);
    // the card's wrapper is the last block: nothing follows it
    expect(bare.querySelector("form")?.parentElement?.nextElementSibling).toBeNull();
  });

  it("is split in two in the Split layout: headline, card and trust lines, then the panel", () => {
    renderWithMessages(
      <HomeHero
        layout="split"
        title="Find the place that fits your life in Chennai."
        emphasis="Chennai"
        subtitle="Shortlist, compare and enquire directly."
        eyebrow="Chennai · Homes, plots & new projects"
        trust={["Approved listings only", "Enquire directly", "Compare up to 3 homes"]}
        sponsor={<aside aria-label="Sponsored panel">panel</aside>}
      >
        <form aria-label="Search card">card</form>
      </HomeHero>,
    );
    const section = screen.getByRole("region", {
      name: "Find the place that fits your life in Chennai.",
    });
    expect(section).toHaveAttribute("data-layout", "split");
    expect(within(section).getByText("Chennai · Homes, plots & new projects")).toBeInTheDocument();
    expect(
      within(section)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Approved listings only", "Enquire directly", "Compare up to 3 homes"]);
    expect(within(section).getByLabelText("Sponsored panel")).toBeInTheDocument();
    expect(within(section).getByRole("form", { name: "Search card" })).toBeInTheDocument();
  });

  it("leaves out the eyebrow, the trust lines and the panel when they are not given", () => {
    renderWithMessages(
      <HomeHero layout="split" title="Headline">
        <form aria-label="Search card">card</form>
      </HomeHero>,
    );
    const section = screen.getByRole("region", { name: "Headline" });
    expect(section.querySelectorAll("ul, aside")).toHaveLength(0);
    expect(section.querySelectorAll("span.inline-flex")).toHaveLength(0);
  });

  it("keeps the Split headline the page's h1 and draws the arches only at the right", () => {
    renderWithMessages(
      <HomeHero layout="split" title="Headline">
        <span>card</span>
      </HomeHero>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Headline" })).toBeVisible();
    // Search Desk has two sets of three arches, Split has the right set only
    expect(document.querySelectorAll("svg path")).toHaveLength(3);
  });
});
