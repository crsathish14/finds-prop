// @vitest-environment jsdom
import { act, fireEvent, screen, within } from "@testing-library/react";
import { MapPin, ShieldCheck } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Link } from "@/components/ui/link";
import { renderWithMessages } from "../../../../tests/render-intl";
import { CategoryCard } from "../category-card";
import { CtaBand } from "../cta-band";
import { ScrollRow } from "../scroll-row";
import { SectionHead } from "../section-head";
import { ValueCard } from "../value-card";

/**
 * jsdom lays nothing out, so Embla is replaced by a stand-in the tests can drive: how many stops it
 * has, how far along it is, and the calls the row makes on it (the buttons and the wheel).
 */
const embla = vi.hoisted(() => {
  const handlers = new Map<string, Set<() => void>>();
  const state = {
    stops: 4,
    progress: 0,
    target: 0,
    root: null as HTMLElement | null,
    options: null as Record<string, unknown> | null,
  };
  const scrollNext = vi.fn();
  const scrollPrev = vi.fn();
  const distance = vi.fn();
  const api = {
    on(event: string, handler: () => void) {
      handlers.set(event, (handlers.get(event) ?? new Set()).add(handler));
      return api;
    },
    off(event: string, handler: () => void) {
      handlers.get(event)?.delete(handler);
      return api;
    },
    scrollSnapList: () => Array.from({ length: state.stops }, (_, index) => -300 * index),
    scrollProgress: () => state.progress,
    rootNode: () => state.root as HTMLElement,
    internalEngine: () => ({
      scrollSnaps: Array.from({ length: state.stops }, (_, index) => -300 * index),
      target: { get: () => state.target },
      scrollTo: { distance },
    }),
    scrollNext,
    scrollPrev,
  };
  return {
    api,
    state,
    scrollNext,
    scrollPrev,
    distance,
    emit(event: string) {
      handlers.get(event)?.forEach((handler) => handler());
    },
    reset() {
      handlers.clear();
      state.stops = 4;
      state.progress = 0;
      state.target = 0;
      state.options = null;
      state.root = document.createElement("div");
      scrollNext.mockClear();
      scrollPrev.mockClear();
      distance.mockClear();
    },
  };
});

vi.mock("embla-carousel-react", () => ({
  default: (options: Record<string, unknown>) => {
    embla.state.options = options;
    return [() => {}, embla.api];
  },
}));

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
  beforeEach(() => embla.reset());
  afterEach(() => vi.restoreAllMocks());

  function cards(count: number) {
    return Array.from({ length: count }, (_, index) => (
      <a key={index} href={`/p/${index}`}>
        Home {index + 1}
      </a>
    ));
  }

  /** Moves the stand-in carousel to a share of the way (0 start, 1 end) and lets the row hear it. */
  function moveTo(progress: number) {
    act(() => {
      embla.state.progress = progress;
      embla.emit("scroll");
    });
  }

  /** A sideways wheel turn over the row; returns whether the row took it from the page. */
  function turnWheel(init: WheelEventInit) {
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init });
    act(() => {
      embla.state.root?.dispatchEvent(event);
    });
    return event.defaultPrevented;
  }

  function fillWidth() {
    return (
      document.querySelector<HTMLElement>("[data-slot='scroll-row-progress-fill']") as HTMLElement
    ).style.width;
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
    moveTo(0);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("moves the carousel one screenful when Next or Previous is pressed", () => {
    renderWithMessages(
      <ScrollRow title="Newest" label="Newest homes">
        {cards(6)}
      </ScrollRow>,
    );
    moveTo(0);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(embla.scrollNext).toHaveBeenCalledTimes(1);
    moveTo(0.4);
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(embla.scrollPrev).toHaveBeenCalledTimes(1);
  });

  it("is an Embla carousel that glides, and moves without animation when the visitor asks for less motion", () => {
    const view = renderWithMessages(
      <ScrollRow title="Newest" label="Newest homes">
        {cards(6)}
      </ScrollRow>,
    );
    expect(embla.state.options).toMatchObject({ dragFree: true, align: "start", duration: 25 });
    view.unmount();

    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: true,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    renderWithMessages(
      <ScrollRow title="Newest" label="Newest homes">
        {cards(6)}
      </ScrollRow>,
    );
    expect(embla.state.options).toMatchObject({ duration: 0 });
  });

  it("disables Next at the end and enables Previous", () => {
    renderWithMessages(
      <ScrollRow title="Newest" label="Newest homes">
        {cards(6)}
      </ScrollRow>,
    );
    moveTo(1);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });

  it("treats a hair from the end as the end (zoomed screens)", () => {
    renderWithMessages(
      <ScrollRow title="Newest" label="Newest homes">
        {cards(6)}
      </ScrollRow>,
    );
    moveTo(0.998);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("disables both buttons and hides the bar when everything fits", () => {
    embla.state.stops = 1;
    renderWithMessages(
      <ScrollRow title="Newest" label="Newest homes">
        {cards(1)}
      </ScrollRow>,
    );
    moveTo(0);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(document.querySelector("[data-slot='scroll-row-progress']")).toHaveClass("invisible");
  });

  it("shows a progress bar instead of a scrollbar: partly full at the start, full at the end", () => {
    renderWithMessages(
      <ScrollRow title="Newest" label="Newest homes">
        {cards(6)}
      </ScrollRow>,
    );
    const track = document.querySelector("[data-slot='scroll-row-progress']");
    expect(track).toHaveAttribute("aria-hidden", "true");
    moveTo(0);
    expect(track).not.toHaveClass("invisible");
    expect(fillWidth()).toBe("15%");
    moveTo(0.5);
    expect(Number.parseFloat(fillWidth())).toBeCloseTo(57.5, 5);
    moveTo(1);
    expect(fillWidth()).toBe("100%");
    // The list keeps no native scrollbar of its own: the viewport clips, Embla moves.
    expect(screen.getByRole("list", { name: "Newest homes" }).parentElement).toHaveClass(
      "overflow-hidden",
    );
  });

  it("follows a sideways wheel turn and takes it from the page", () => {
    renderWithMessages(
      <ScrollRow title="Newest" label="Newest homes">
        {cards(6)}
      </ScrollRow>,
    );
    expect(turnWheel({ deltaX: 120, deltaY: 0 })).toBe(true);
    expect(embla.distance).toHaveBeenLastCalledWith(-120, false);
    embla.state.target = -600;
    expect(turnWheel({ deltaX: -80, deltaY: 5 })).toBe(true);
    expect(embla.distance).toHaveBeenLastCalledWith(80, false);
  });

  it("moves on Shift + wheel, and reads a wheel that counts lines as lines", () => {
    renderWithMessages(
      <ScrollRow title="Newest" label="Newest homes">
        {cards(6)}
      </ScrollRow>,
    );
    expect(turnWheel({ deltaY: 100, shiftKey: true })).toBe(true);
    expect(embla.distance).toHaveBeenLastCalledWith(-100, false);
    expect(turnWheel({ deltaX: 3, deltaMode: 1 })).toBe(true);
    expect(embla.distance).toHaveBeenLastCalledWith(-48, false);
  });

  it("leaves an up-down wheel to the page, and a sideways one at the row's ends", () => {
    renderWithMessages(
      <ScrollRow title="Newest" label="Newest homes">
        {cards(6)}
      </ScrollRow>,
    );
    expect(turnWheel({ deltaY: 100 })).toBe(false);
    // At the start, a turn to the left has nowhere to go.
    expect(turnWheel({ deltaX: -100 })).toBe(false);
    embla.state.target = -900;
    // At the end, a turn to the right has nowhere to go.
    expect(turnWheel({ deltaX: 100 })).toBe(false);
    expect(embla.distance).not.toHaveBeenCalled();
  });

  it("does not move further than the last stop", () => {
    renderWithMessages(
      <ScrollRow title="Newest" label="Newest homes">
        {cards(6)}
      </ScrollRow>,
    );
    embla.state.target = -850;
    turnWheel({ deltaX: 500 });
    expect(embla.distance).toHaveBeenLastCalledWith(-50, false);
  });
});
