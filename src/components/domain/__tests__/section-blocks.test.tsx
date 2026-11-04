// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { MapPin, ShieldCheck } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Link } from "@/components/ui/link";
import { renderWithMessages } from "../../../../tests/render-intl";
import { CategoryCard } from "../category-card";
import { CtaBand } from "../cta-band";
import { ScrollRow } from "../scroll-row";
import { SectionHead } from "../section-head";
import { ValueCard } from "../value-card";

describe("SectionHead: the title row of a homepage section (S4-T06)", () => {
  it("is a level 2 heading by default and a level 3 on request", () => {
    const view = renderWithMessages(<SectionHead title="Explore by locality" />);
    expect(screen.getByRole("heading", { level: 2, name: "Explore by locality" })).toBeVisible();
    view.unmount();
    renderWithMessages(<SectionHead as="h3" title="Inside a section" />);
    expect(screen.getByRole("heading", { level: 3, name: "Inside a section" })).toBeVisible();
  });

  it("shows the line under the title and the action at the right, and leaves them out when missing", () => {
    const view = renderWithMessages(
      <SectionHead
        title="New launches from developers"
        description="Approved and published projects only."
        action={<Link href="/projects">See all projects</Link>}
      />,
    );
    expect(screen.getByText("Approved and published projects only.")).toBeVisible();
    expect(screen.getByRole("link", { name: "See all projects" })).toBeVisible();
    view.unmount();

    renderWithMessages(<SectionHead title="Alone" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(document.querySelector("p")).not.toBeInTheDocument();
  });

  it("keeps an emphasised word inside the heading, so the heading reads as one title", () => {
    renderWithMessages(<SectionHead title="Why Find Prop" emphasis="Find Prop" />);
    const heading = screen.getByRole("heading", { level: 2, name: "Why Find Prop" });
    expect(heading).toBeVisible();
    // The copper text colour, not the fill copper: the fill fails 4.5 : 1 at the phone size.
    expect(within(heading).getByText("Find Prop").className).toContain("text-cta-text");
    expect(within(heading).getByText("Find Prop").tagName).toBe("EM");
  });

  it("passes an id on, so a section can be named by its heading", () => {
    renderWithMessages(<SectionHead id="locality-title" title="Explore by locality" />);
    expect(screen.getByRole("heading")).toHaveAttribute("id", "locality-title");
  });
});

describe("CategoryCard: a tinted card that leads to one way of browsing (S4-T06)", () => {
  it("is one link, named by its title and its line", () => {
    renderWithMessages(
      <CategoryCard
        icon={MapPin}
        title="By locality"
        description="Browse homes area by area across Chennai"
        href="/properties"
      />,
    );
    const link = screen.getByRole("link", {
      name: "By locality Browse homes area by area across Chennai",
    });
    expect(link).toHaveAttribute("href", "/properties");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("hides the icon and the copper arrow from screen readers", () => {
    renderWithMessages(
      <CategoryCard icon={MapPin} title="Budget" description="Smaller budget" href="/x" />,
    );
    const link = screen.getByRole("link");
    for (const drawing of Array.from(link.querySelectorAll("svg"))) {
      expect(drawing.closest("[aria-hidden='true']") ?? drawing).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    }
    expect(link.querySelectorAll("svg")).toHaveLength(2);
  });

  it("uses a different surface for each of the four tints", () => {
    const surface = (tint: 1 | 2 | 3 | 4) => {
      const view = renderWithMessages(
        <CategoryCard icon={MapPin} title="X" description="Y" href="/x" tint={tint} />,
      );
      const className = screen.getByRole("link").className;
      view.unmount();
      return className;
    };
    expect(surface(1)).toContain("from-cta-tint");
    expect(surface(2)).toContain("from-primary-tint");
    expect(surface(3)).toContain("from-neutral-tint");
    expect(surface(4)).toContain("from-primary-tint");
  });

  it("starts with the first tint", () => {
    renderWithMessages(<CategoryCard icon={MapPin} title="X" description="Y" href="/x" />);
    expect(screen.getByRole("link")).toHaveAttribute("data-tint", "1");
  });
});

describe("ValueCard: one reason to use Find Prop (S4-T06)", () => {
  it("shows a level 3 heading and a sentence, and is not a link", () => {
    renderWithMessages(
      <ValueCard
        icon={ShieldCheck}
        title="Approved listings only"
        description="Homes appear on Find Prop after they are approved."
      />,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Approved listings only" })).toBeVisible();
    expect(screen.getByText("Homes appear on Find Prop after they are approved.")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("hides the icon from screen readers", () => {
    renderWithMessages(<ValueCard icon={ShieldCheck} title="T" description="D" />);
    expect(document.querySelector("svg")?.closest("[aria-hidden='true']")).not.toBeNull();
  });
});

describe("CtaBand: the banner that invites a visitor to post a property (S4-T06)", () => {
  it("shows a level 2 heading, a line and one link named by its label", () => {
    renderWithMessages(
      <CtaBand
        title="Want to sell or rent your property?"
        description="Post your property free. Your listing is reviewed, then goes live."
        actionLabel="Post your property free"
        href="/post-property"
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Want to sell or rent your property?" }),
    ).toBeVisible();
    expect(
      screen.getByText("Post your property free. Your listing is reviewed, then goes live."),
    ).toBeVisible();
    const link = screen.getByRole("link", { name: "Post your property free" });
    expect(link).toHaveAttribute("href", "/post-property");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("leaves out the line when there is none, and hides its arches from screen readers", () => {
    renderWithMessages(<CtaBand title="Title" actionLabel="Go" href="/x" />);
    expect(document.querySelector("p")).not.toBeInTheDocument();
    const arches = document.querySelector("[data-slot='cta-band'] > svg");
    expect(arches).toHaveAttribute("aria-hidden", "true");
  });

  it("is a copper button on the link, as the UX draws it", () => {
    renderWithMessages(<CtaBand title="Title" actionLabel="Go" href="/x" />);
    expect(screen.getByRole("link", { name: "Go" }).className).toContain("bg-cta");
  });
});

describe("ScrollRow: a titled row of cards that scrolls sideways (S4-T06)", () => {
  afterEach(() => vi.restoreAllMocks());

  function cards(count: number) {
    return Array.from({ length: count }, (_, index) => (
      <a key={index} href={`/p/${index}`}>
        Home {index + 1}
      </a>
    ));
  }

  /** jsdom lays nothing out, so the row's sizes are set by hand before the first scroll event. */
  function measureRow(list: HTMLElement, sizes: { client: number; scroll: number; left: number }) {
    Object.defineProperty(list, "clientWidth", { configurable: true, value: sizes.client });
    Object.defineProperty(list, "scrollWidth", { configurable: true, value: sizes.scroll });
    list.scrollLeft = sizes.left;
    fireEvent.scroll(list);
  }

  it("is a list named by its label, with one item for each card, under a level 2 title", () => {
    renderWithMessages(
      <ScrollRow title="Newest on Find Prop" label="Newest homes">
        {cards(3)}
      </ScrollRow>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Newest on Find Prop" })).toBeVisible();
    const list = screen.getByRole("list", { name: "Newest homes" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByRole("link", { name: "Home 2" })).toHaveAttribute("href", "/p/1");
  });

  it("is left out when there are no cards, title and all", () => {
    const view = renderWithMessages(
      <ScrollRow title="Newest on Find Prop" label="Newest homes">
        {null}
        {false}
      </ScrollRow>,
    );
    expect(view.container).toBeEmptyDOMElement();
  });

  it("has Previous and Next buttons, and Previous is disabled at the start", () => {
    renderWithMessages(
      <ScrollRow title="Newest" label="Newest homes">
        {cards(6)}
      </ScrollRow>,
    );
    const list = screen.getByRole("list", { name: "Newest homes" });
    measureRow(list, { client: 500, scroll: 2000, left: 0 });
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("moves the row by most of what is showing when Next is pressed", () => {
    renderWithMessages(
      <ScrollRow title="Newest" label="Newest homes">
        {cards(6)}
      </ScrollRow>,
    );
    const list = screen.getByRole("list", { name: "Newest homes" });
    const scrollBy = vi.fn();
    list.scrollBy = scrollBy;
    measureRow(list, { client: 500, scroll: 2000, left: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(scrollBy).toHaveBeenCalledWith({ left: 400, behavior: "smooth" });
    measureRow(list, { client: 500, scroll: 2000, left: 400 });
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -400, behavior: "smooth" });
  });

  it("scrolls without animation when the visitor asks for less motion", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) => ({ matches: true, media: query }) as MediaQueryList,
    );
    renderWithMessages(
      <ScrollRow title="Newest" label="Newest homes">
        {cards(6)}
      </ScrollRow>,
    );
    const list = screen.getByRole("list", { name: "Newest homes" });
    const scrollBy = vi.fn();
    list.scrollBy = scrollBy;
    measureRow(list, { client: 500, scroll: 2000, left: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(scrollBy).toHaveBeenCalledWith({ left: 400, behavior: "auto" });
  });

  it("disables Next at the end and enables Previous", () => {
    renderWithMessages(
      <ScrollRow title="Newest" label="Newest homes">
        {cards(6)}
      </ScrollRow>,
    );
    const list = screen.getByRole("list", { name: "Newest homes" });
    measureRow(list, { client: 500, scroll: 2000, left: 1500 });
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });

  it("treats a fraction of a pixel from the end as the end (zoomed screens)", () => {
    renderWithMessages(
      <ScrollRow title="Newest" label="Newest homes">
        {cards(6)}
      </ScrollRow>,
    );
    const list = screen.getByRole("list", { name: "Newest homes" });
    measureRow(list, { client: 500, scroll: 2000, left: 1499 });
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("disables both buttons when everything fits", () => {
    renderWithMessages(
      <ScrollRow title="Newest" label="Newest homes">
        {cards(1)}
      </ScrollRow>,
    );
    const list = screen.getByRole("list", { name: "Newest homes" });
    measureRow(list, { client: 500, scroll: 316, left: 0 });
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});
