// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
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

const scrollTo = vi.fn();

beforeEach(() => {
  scrollTo.mockClear();
  Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo;
});
afterEach(() => vi.restoreAllMocks());

/** jsdom lays nothing out, so the picture area's width is set by hand. */
function sizeViewport(width = 600) {
  const viewport = document.querySelector<HTMLElement>("[tabindex='0']");
  if (!viewport) throw new Error("no picture area");
  Object.defineProperty(viewport, "clientWidth", { configurable: true, value: width });
  return viewport;
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

  it("shows the next photo when Next is pressed, and scrolls the picture area to it", async () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS} />);
    sizeViewport(600);
    await userEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(count("2 / 5")).toBeInTheDocument();
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 600, behavior: "smooth" });
    await userEvent.click(screen.getByRole("button", { name: "Previous photo" }));
    expect(count("1 / 5")).toBeInTheDocument();
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: "smooth" });
  });

  it("disables Previous on the first photo and Next on the last", async () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS} />);
    sizeViewport();
    expect(screen.getByRole("button", { name: "Previous photo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next photo" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Photo 5" }));
    expect(screen.getByRole("button", { name: "Next photo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous photo" })).toBeEnabled();
  });

  it("shows the photo of a thumbnail that is pressed", async () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS} />);
    sizeViewport(500);
    await userEvent.click(screen.getByRole("button", { name: "Photo 4: Kitchen" }));
    expect(count("4 / 5")).toBeInTheDocument();
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 1500, behavior: "smooth" });
  });

  it("changes the photo with the left and right arrow keys and stops at the ends", async () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS} />);
    const viewport = sizeViewport();
    viewport.focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(count("3 / 5")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    expect(count("1 / 5")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowLeft}");
    expect(count("1 / 5")).toBeInTheDocument();
  });

  it("follows a swipe: the photo showing is the one the picture area is scrolled to", () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS} />);
    const viewport = sizeViewport(400);
    viewport.scrollLeft = 800;
    fireEvent.scroll(viewport);
    expect(count("3 / 5")).toBeInTheDocument();
    viewport.scrollLeft = 1190;
    fireEvent.scroll(viewport);
    expect(count("4 / 5")).toBeInTheDocument();
  });

  it("does not jump through the photos in between while a press is scrolling to one", async () => {
    renderWithMessages(<PropertyGallery photos={PHOTOS} />);
    const viewport = sizeViewport(400);
    await userEvent.click(screen.getByRole("button", { name: "Photo 5" }));
    viewport.scrollLeft = 400;
    fireEvent.scroll(viewport);
    expect(count("5 / 5")).toBeInTheDocument();
    viewport.scrollLeft = 1600;
    fireEvent.scroll(viewport);
    expect(count("5 / 5")).toBeInTheDocument();
    // Arrived: a later swipe is followed again.
    viewport.scrollLeft = 400;
    fireEvent.scroll(viewport);
    expect(count("2 / 5")).toBeInTheDocument();
  });

  it("scrolls without animation when the visitor asks for less motion", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) => ({ matches: true, media: query }) as MediaQueryList,
    );
    renderWithMessages(<PropertyGallery photos={PHOTOS} />);
    sizeViewport(600);
    await userEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 600, behavior: "auto" });
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
    sizeViewport().focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(scrollTo).not.toHaveBeenCalled();
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
