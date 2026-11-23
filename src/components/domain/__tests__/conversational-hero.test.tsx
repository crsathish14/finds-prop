// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { ConversationalHero, entranceOrder } from "../conversational-hero";

const hero = (over: Partial<React.ComponentProps<typeof ConversationalHero>> = {}) => (
  <ConversationalHero
    title="Find the place that fits your life."
    prompt="Ask in your own words"
    {...over}
  >
    <form role="search" aria-label="Search card">
      card
    </form>
  </ConversationalHero>
);

describe("UT-conversational-hero: the Conversational homepage hero (ADR-177)", () => {
  it("is a region named by its headline, marked as the conversational layout", () => {
    renderWithMessages(hero());
    const section = screen.getByRole("region", { name: "Find the place that fits your life." });
    expect(section).toHaveAttribute("data-slot", "home-hero");
    expect(section).toHaveAttribute("data-layout", "conversational");
    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute("id", "home-hero-title");
  });

  it("puts the prompt first, then the headline, the line, the search, the trust lines and the strip", () => {
    renderWithMessages(
      hero({
        subtitle: "Shortlist, compare and enquire directly.",
        trust: ["Approved listings only", "Enquire directly", "Compare up to 3 homes"],
        sponsor: <aside aria-label="Sponsored strip">strip</aside>,
      }),
    );
    const section = screen.getByRole("region");
    const text = section.textContent ?? "";
    const order = [
      "Ask in your own words",
      "Find the place",
      "Shortlist, compare",
      "card",
      "Approved listings only",
    ].map((part) => text.indexOf(part));
    expect([...order].sort((first, second) => first - second)).toEqual(order);
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(within(section).getAllByRole("listitem")).toHaveLength(3);
    const strip = within(section).getByLabelText("Sponsored strip");
    const search = within(section).getByRole("search");
    expect(search.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("runs the light on the search wrapper and enters in order, with transform and opacity classes only", () => {
    renderWithMessages(hero());
    const wrapper = screen.getByRole("search").parentElement;
    expect(wrapper).toHaveClass("hl-run", "hl-search", "hl-in");
    expect(wrapper?.style.getPropertyValue("--hl-i")).toBe("3");
    expect(entranceOrder(5)).toEqual({ "--hl-i": 5 });
  });

  it("leaves out the line, the trust lines and the strip when they are not given, and leaves no gap", () => {
    renderWithMessages(hero());
    const section = screen.getByRole("region");
    expect(within(section).queryByRole("list")).not.toBeInTheDocument();
    expect(section.querySelectorAll("aside")).toHaveLength(0);
    expect(section.querySelector(".hl-late")).toBeNull();
    // the search wrapper is the last block
    expect(screen.getByRole("search").parentElement?.nextElementSibling).toBeNull();
  });

  it("shows at most three trust lines and hides the pill's icon from screen readers", () => {
    renderWithMessages(hero({ trust: ["one", "two", "three", "four"] }));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Ask in your own words").querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("takes a lower heading level and its own id when it sits inside another page", () => {
    renderWithMessages(hero({ titleAs: "h3", id: "second-hero" }));
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveAttribute("id", "second-hero");
    expect(screen.getByRole("region", { name: /Find the place/ })).toBeInTheDocument();
  });
});
