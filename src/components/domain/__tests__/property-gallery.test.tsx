// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { PropertyGallery, PropertyGallerySkeleton, type GalleryPhoto } from "../property-gallery";

const PHOTOS: GalleryPhoto[] = [
  { src: "/a.jpg", alt: "The front of the building", label: "Exterior" },
  { src: "/b.jpg", alt: "A bright living room", label: "Living room" },
  { src: "/c.jpg", alt: "The main bedroom", label: "Bedroom" },
  { src: "/d.jpg", alt: "A modular kitchen", label: "Kitchen" },
  { src: "/e.jpg", alt: "The view from the balcony" },
];

/**
 * jsdom lays nothing out, so Embla is replaced by a stand-in the tests can drive: it knows which photo it
 * is on, moves when the gallery asks, and tells the gallery about it ("select") as Embla does.
 */
const embla = vi.hoisted(() => {
  const handlers = new Map<string, Set<() => void>>();
  const state = { selected: 0, options: null as Record<string, unknown> | null };
  const scrollTo = vi.fn();
  const api = {
    on(event: string, handler: () => void) {
      handlers.set(event, (handlers.get(event) ?? new Set()).add(handler));
      return api;
    },
    off(event: string, handler: () => void) {
      handlers.get(event)?.delete(handler);
      return api;
    },
    selectedScrollSnap: () => state.selected,
    scrollTo,
  };
  function emit(event: string) {
    handlers.get(event)?.forEach((handler) => handler());
  }
  return {
    api,
    state,
    scrollTo,
    emit,
    /** A swipe, or a glide that has arrived: the photo showing is now this one. */
    settleOn(index: number) {
      state.selected = index;
      emit("select");
    },
    reset() {
      handlers.clear();
      state.selected = 0;
      state.options = null;
      scrollTo.mockReset();
      scrollTo.mockImplementation((index: number) => {
        state.selected = index;
        emit("select");
      });
    },
  };
});

vi.mock("embla-carousel-react", () => ({
  default: (options: Record<string, unknown>) => {
    embla.state.options = options;
    // The photo asked for first is where it starts.
    if (typeof options.startIndex === "number" && embla.state.selected === 0) {
      embla.state.selected = options.startIndex;
    }
    return [() => {}, embla.api];
  },
}));

beforeEach(() => embla.reset());
afterEach(() => vi.restoreAllMocks());

/** The picture area, which takes focus. */
function viewport() {
  const node = document.querySelector<HTMLElement>("[tabindex='0']");
  if (!node) throw new Error("no picture area");
  return node;
}

const count = (text: string) => screen.getByText(text);

describe("PropertyGallery: the photos of one home (S4-T01)", () => {
  it("is a carousel named Photos, with a slide for each photo and the count of the first", () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS} />);
    const carousel = screen.getByRole("group", { name: "Photos" });
    expect(carousel).toHaveAttribute("aria-roledescription", "carousel");
    const slides = carousel.querySelectorAll("[aria-roledescription=slide]");
    expect([...slides].map((slide) => slide.getAttribute("aria-label"))).toEqual([
      "1 of 5",
      "2 of 5",
      "3 of 5",
      "4 of 5",
      "5 of 5",
    ]);
    expect(count("1 / 5")).toBeInTheDocument();
  });

  it("exposes only the photo that is showing to a screen reader", () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS} />);
    const slides = document.querySelectorAll("[aria-roledescription=slide]");
    expect([...slides].map((slide) => slide.getAttribute("aria-hidden"))).toEqual([
      null,
      "true",
      "true",
      "true",
      "true",
    ]);
  });

  it("names the thumbnails by number and label, and by number alone when there is no label", () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS} />);
    expect(screen.getByRole("button", { name: "Photo 1: Exterior" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Photo 4: Kitchen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Photo 5" })).toBeInTheDocument();
  });

  it("marks the thumbnail of the photo showing as current", () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS} startIndex={2} />);
    expect(screen.getByRole("button", { name: "Photo 3: Bedroom" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: "Photo 1: Exterior" })).toHaveAttribute(
      "aria-current",
      "false",
    );
    expect(count("3 / 5")).toBeInTheDocument();
  });

  it("shows the next photo when Next is pressed, and glides the carousel to it", async () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS} />);
    await userEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(count("2 / 5")).toBeInTheDocument();
    expect(embla.scrollTo).toHaveBeenLastCalledWith(1);
    await userEvent.click(screen.getByRole("button", { name: "Previous photo" }));
    expect(count("1 / 5")).toBeInTheDocument();
    expect(embla.scrollTo).toHaveBeenLastCalledWith(0);
  });

  it("disables Previous on the first photo and Next on the last", async () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS} />);
    expect(screen.getByRole("button", { name: "Previous photo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next photo" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Photo 5" }));
    expect(screen.getByRole("button", { name: "Next photo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous photo" })).toBeEnabled();
  });

  it("shows the photo of a thumbnail that is pressed", async () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS} />);
    await userEvent.click(screen.getByRole("button", { name: "Photo 4: Kitchen" }));
    expect(count("4 / 5")).toBeInTheDocument();
    expect(embla.scrollTo).toHaveBeenLastCalledWith(3);
  });

  it("changes the photo with the left and right arrow keys and stops at the ends", async () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS} />);
    viewport().focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(count("3 / 5")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    expect(count("1 / 5")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowLeft}");
    expect(count("1 / 5")).toBeInTheDocument();
  });

  it("follows a swipe: the photo showing is the one the carousel settles on", () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS} />);
    act(() => embla.settleOn(2));
    expect(count("3 / 5")).toBeInTheDocument();
    act(() => embla.settleOn(3));
    expect(count("4 / 5")).toBeInTheDocument();
  });

  it("starts on the photo asked for, and lets the carousel drag only when there are several photos", () => {
    const view = renderWithMessages(<PropertyGallery photos={PHOTOS} startIndex={2} />);
    expect(embla.state.options).toMatchObject({ startIndex: 2, watchDrag: true, duration: 25 });
    view.unmount();
    renderWithMessages(<PropertyGallery photos={PHOTOS.slice(0, 1)} />);
    expect(embla.state.options).toMatchObject({ watchDrag: false });
  });

  it("glides without animation when the visitor asks for less motion", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: true,
          media: query,
          addEventListener() {},
          removeEventListener() {},
        }) as unknown as MediaQueryList,
    );
    renderWithMessages(<PropertyGallery photos={PHOTOS} />);
    expect(embla.state.options).toMatchObject({ duration: 0 });
  });

  it("announces the count politely", () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS} />);
    expect(count("1 / 5").closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
  });

  it("draws the badges the page gives it over the picture", () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS} badges={<span>For sale</span>} />);
    expect(screen.getByText("For sale")).toBeInTheDocument();
  });

  it("starts on the photo asked for, kept within the photos it has", () => {
    const view = renderWithMessages(<PropertyGallery photos={PHOTOS} startIndex={99} />);
    expect(count("5 / 5")).toBeInTheDocument();
    view.unmount();
    embla.reset();
    renderWithMessages(<PropertyGallery photos={PHOTOS} startIndex={-3} />);
    expect(count("1 / 5")).toBeInTheDocument();
  });

  it("runs edge to edge on a phone by default, and stays in the page's padding when asked", () => {
    const view = renderWithMessages(<PropertyGallery photos={PHOTOS} />);
    expect(document.querySelector("[data-slot='property-gallery'] > div")?.className).toContain(
      "-mx-(--gutter)",
    );
    view.unmount();
    renderWithMessages(<PropertyGallery photos={PHOTOS} bleed={false} />);
    expect(document.querySelector("[data-slot='property-gallery'] > div")?.className).not.toContain(
      "-mx-(--gutter)",
    );
  });

  it("replaces a photo that fails to load with the illustrated tile", () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS.slice(0, 2)} />);
    const first = document.querySelector("img");
    if (!first) throw new Error("no image");
    fireEvent.error(first);
    // Its slide shows the tile; the thumbnail of the same photo is its own picture and is still there.
    expect(document.querySelectorAll("[data-slot='card-cover-fallback']")).toHaveLength(1);
    expect(
      screen.queryByRole("img", { name: "The front of the building" }),
    ).not.toBeInTheDocument();
  });
});

describe("PropertyGallery: one photo and none (S4-T01)", () => {
  it("hides the buttons, thumbnails, dots and count for one photo, and the photo is still there", () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS.slice(0, 1)} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/ \/ /)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "The front of the building" })).toBeInTheDocument();
    expect(document.querySelector("[aria-hidden='true'].flex")).not.toBeInTheDocument();
  });

  it("shows the illustrated tile and no controls when there is no photo", () => {
    renderWithMessages(<PropertyGallery photos={[]} />);
    expect(document.querySelector("[data-slot='card-cover-fallback']")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/ \/ /)).not.toBeInTheDocument();
  });

  it("does not move on an arrow key when there is only one photo", async () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS.slice(0, 1)} />);
    viewport().focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(embla.scrollTo).not.toHaveBeenCalled();
  });
});

describe("PropertyGallerySkeleton (S4-T01)", () => {
  it("is a box of the picture's shape, with no controls", () => {
    renderWithMessages(<PropertyGallerySkeleton />);
    const box = document.querySelector("[data-slot='property-gallery-skeleton']");
    expect(box?.className).toContain("aspect-16/10");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
