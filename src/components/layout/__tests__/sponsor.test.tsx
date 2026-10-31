// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SPONSOR_ROTATION_MS } from "@/lib/sponsors";
import { NEAR_MISS_AD, SAMPLE_AD_A, SAMPLE_AD_B, SAMPLE_AD_C } from "@/lib/sponsors.fixtures";
import { renderWithMessages } from "../../../../tests/render-intl";
import { SponsorSlot } from "../sponsor-slot";

const THREE = [SAMPLE_AD_A, SAMPLE_AD_B, SAMPLE_AD_C];

describe("SponsorSlot: nothing to show", () => {
  it("renders nothing at all: no frame, no label, no gap", () => {
    const { container } = renderWithMessages(<SponsorSlot ads={[]} placement="hero" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when no ad is the right format for the layout", () => {
    const stripOnly = { ...SAMPLE_AD_A };
    delete stripOnly.panel;
    const { container } = renderWithMessages(
      <SponsorSlot ads={[stripOnly]} placement="hero" layout="split" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("SponsorSlot: one ad", () => {
  it("shows the Sponsored label outside the picture, About this ad, and a safe link", () => {
    renderWithMessages(<SponsorSlot ads={[SAMPLE_AD_A]} placement="hero" />);
    expect(screen.getByText("Sponsored")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "About this ad" })).toBeInTheDocument();
    const link = screen.getByRole("link", {
      name: "Sample advertiser banner A (opens in a new tab)",
    });
    expect(link).toHaveAttribute("href", "https://sponsor.example/a");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "sponsored noopener");
    expect(link.closest("[data-slot=sponsor-slot]")).toHaveAttribute("data-format", "strip");
  });

  it("has no pager with one ad", () => {
    renderWithMessages(<SponsorSlot ads={[SAMPLE_AD_A]} placement="hero" />);
    expect(screen.queryByRole("button", { name: /sponsored banner/ })).not.toBeInTheDocument();
  });

  it("uses the panel format for the split layout", () => {
    const { container } = renderWithMessages(
      <SponsorSlot ads={[SAMPLE_AD_A]} placement="hero" layout="split" />,
    );
    expect(container.querySelector("[data-slot=sponsor-slot]")).toHaveAttribute(
      "data-format",
      "panel",
    );
  });

  it("serves a desktop and a compact picture from one <picture>", () => {
    const { container } = renderWithMessages(<SponsorSlot ads={[SAMPLE_AD_A]} placement="hero" />);
    const source = container.querySelector("source");
    expect(source).toHaveAttribute("media", "(min-width: 1024px)");
    expect(source?.getAttribute("srcset")).toContain("strip-970x90-a.svg");
    expect(container.querySelector("img")?.getAttribute("src")).toContain("strip-m-320x100-a.svg");
  });

  it("shows a near-miss picture whole, on a neutral ground", () => {
    renderWithMessages(<SponsorSlot ads={[NEAR_MISS_AD]} placement="hero" />);
    const link = screen.getByRole("link");
    expect(link).toHaveClass("bg-canvas-sunken");
    expect(link.querySelector("img")).toHaveClass("object-contain");
  });

  it("fills the frame when the picture is the right shape", () => {
    renderWithMessages(<SponsorSlot ads={[SAMPLE_AD_A]} placement="hero" />);
    expect(screen.getByRole("link").querySelector("img")).toHaveClass("object-cover");
  });
});

describe("SponsorSlot: several ads", () => {
  it("shows the first ad with a manual pager and a count, and no autoplay", () => {
    renderWithMessages(<SponsorSlot ads={THREE} placement="hero" />);
    expect(screen.getByRole("link")).toHaveAccessibleName(/banner A/);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("moves to the next and previous ad, wrapping around, and announces the position", async () => {
    renderWithMessages(<SponsorSlot ads={THREE} placement="hero" />);
    await userEvent.click(screen.getByRole("button", { name: "Next sponsored banner" }));
    expect(screen.getByRole("link")).toHaveAccessibleName(/banner B/);
    expect(screen.getByText("Banner 2 of 3")).toHaveAttribute("aria-live", "polite");
    await userEvent.click(screen.getByRole("button", { name: "Previous sponsored banner" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous sponsored banner" }));
    expect(screen.getByRole("link")).toHaveAccessibleName(/banner C/);
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next sponsored banner" }));
    expect(screen.getByRole("link")).toHaveAccessibleName(/banner A/);
  });
});

describe("SponsorSlot: About this ad", () => {
  it("opens a popover explaining that it is a paid placement", async () => {
    renderWithMessages(<SponsorSlot ads={[SAMPLE_AD_A]} placement="hero" />);
    await userEvent.click(screen.getByRole("button", { name: "About this ad" }));
    expect(screen.getByText("About sponsored content")).toBeInTheDocument();
    expect(screen.getByText(/paid placement/)).toBeInTheDocument();
  });

  it("can start open, for the Design Lab", () => {
    renderWithMessages(<SponsorSlot ads={[SAMPLE_AD_A]} placement="hero" defaultInfoOpen />);
    expect(screen.getByText("About sponsored content")).toBeInTheDocument();
  });
});

describe("SponsorSlot: a picture that fails to load", () => {
  it("removes that ad and carries on with the others", () => {
    const { container } = renderWithMessages(
      <SponsorSlot ads={[SAMPLE_AD_A, SAMPLE_AD_B]} placement="hero" />,
    );
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(screen.getByRole("link")).toHaveAccessibleName(/banner B/);
    expect(screen.queryByRole("button", { name: "Next sponsored banner" })).not.toBeInTheDocument();
  });

  it("removes the whole slot when every picture fails, leaving no label behind", () => {
    const { container } = renderWithMessages(<SponsorSlot ads={[SAMPLE_AD_A]} placement="hero" />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Sponsored")).not.toBeInTheDocument();
  });
});

describe("SponsorSlot: carousel", () => {
  const current = () =>
    screen
      .getAllByRole("group", { hidden: false })
      .map((slide) => slide.getAttribute("aria-label"));

  it("is a labelled carousel whose slides are groups named by position", () => {
    renderWithMessages(<SponsorSlot ads={THREE} placement="hero" />);
    const region = screen.getByRole("region", { name: "Sponsored banners" });
    expect(region).toHaveAttribute("aria-roledescription", "carousel");
    const slides = region.querySelectorAll("[aria-roledescription=slide]");
    expect([...slides].map((slide) => slide.getAttribute("aria-label"))).toEqual([
      "Banner 1 of 3",
      "Banner 2 of 3",
      "Banner 3 of 3",
    ]);
  });

  it("lets Tab and screen readers reach only the banner on show", () => {
    renderWithMessages(<SponsorSlot ads={THREE} placement="hero" />);
    expect(current()).toEqual(["Banner 1 of 3"]);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    const slides = document.querySelectorAll("[aria-roledescription=slide]");
    expect(slides[0]).not.toHaveAttribute("aria-hidden");
    expect(slides[1]).toHaveAttribute("aria-hidden", "true");
    expect(slides[1]).toHaveAttribute("inert");
  });

  it("loads every picture, the first at once and the rest at low priority, never lazily", () => {
    const { container } = renderWithMessages(<SponsorSlot ads={THREE} placement="hero" />);
    const images = [...container.querySelectorAll("img")];
    expect(images).toHaveLength(3);
    expect(images.map((image) => image.getAttribute("loading"))).not.toContain("lazy");
    expect(images[0]?.getAttribute("fetchpriority")).not.toBe("low");
    expect(images[1]?.getAttribute("fetchpriority")).toBe("low");
    expect(images[2]?.getAttribute("fetchpriority")).toBe("low");
  });

  it("is still, with no pager, no carousel behaviour and no hidden slides, for one ad", () => {
    renderWithMessages(<SponsorSlot ads={[SAMPLE_AD_A]} placement="hero" />);
    expect(screen.queryByRole("button", { name: /sponsored banner/ })).not.toBeInTheDocument();
    expect(document.querySelectorAll("[aria-hidden=true][inert]")).toHaveLength(0);
  });

  it("does not announce the position while it turns by itself, only when the reader moves it", async () => {
    renderWithMessages(<SponsorSlot ads={THREE} placement="hero" />);
    const live = document.querySelector("p[aria-live=polite]");
    expect(live).toHaveTextContent("");
    await userEvent.click(screen.getByRole("button", { name: "Next sponsored banner" }));
    expect(live).toHaveTextContent("Banner 2 of 3");
  });

  it("moves to the next banner with the next button and back with previous, wrapping round", async () => {
    renderWithMessages(<SponsorSlot ads={THREE} placement="hero" />);
    await userEvent.click(screen.getByRole("button", { name: "Previous sponsored banner" }));
    expect(current()).toEqual(["Banner 3 of 3"]);
    await userEvent.click(screen.getByRole("button", { name: "Next sponsored banner" }));
    expect(current()).toEqual(["Banner 1 of 3"]);
  });
});

describe("SponsorSlot: automatic rotation every 5 seconds", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const shown = () => document.querySelector("[aria-roledescription=slide]:not([inert])");
  const wait = (milliseconds: number) => act(() => void vi.advanceTimersByTime(milliseconds));

  it("shows the next banner after 5 seconds, and the one after that after 5 more", () => {
    renderWithMessages(<SponsorSlot ads={THREE} placement="hero" />);
    expect(shown()).toHaveAttribute("aria-label", "Banner 1 of 3");
    wait(4900);
    expect(shown()).toHaveAttribute("aria-label", "Banner 1 of 3");
    wait(200);
    expect(shown()).toHaveAttribute("aria-label", "Banner 2 of 3");
    wait(5100);
    expect(shown()).toHaveAttribute("aria-label", "Banner 3 of 3");
    wait(5100);
    expect(shown()).toHaveAttribute("aria-label", "Banner 1 of 3");
  });

  it("waits while the pointer is over the banner, and goes on when it leaves", () => {
    renderWithMessages(<SponsorSlot ads={THREE} placement="hero" />);
    const region = screen.getByRole("region", { name: "Sponsored banners" });
    act(() => void fireEvent.mouseEnter(region));
    wait(12000);
    expect(shown()).toHaveAttribute("aria-label", "Banner 1 of 3");
    act(() => void fireEvent.mouseLeave(region));
    wait(5100);
    expect(shown()).toHaveAttribute("aria-label", "Banner 2 of 3");
  });

  it("waits while focus is on any control in the banner area, and goes on when it leaves", () => {
    renderWithMessages(<SponsorSlot ads={THREE} placement="hero" />);
    const next = screen.getByRole("button", { name: "Next sponsored banner" });
    act(() => void fireEvent.focus(next));
    wait(12000);
    expect(shown()).toHaveAttribute("aria-label", "Banner 1 of 3");
    act(() => void fireEvent.blur(next, { relatedTarget: document.body }));
    wait(5100);
    expect(shown()).toHaveAttribute("aria-label", "Banner 2 of 3");
  });

  it("does not turn by itself with one banner", () => {
    renderWithMessages(<SponsorSlot ads={[SAMPLE_AD_A]} placement="hero" />);
    wait(12000);
    expect(document.querySelectorAll("[aria-roledescription=slide]")).toHaveLength(1);
    expect(screen.getByRole("link")).toBeInTheDocument();
  });

  it("never starts for a reader who prefers reduced motion", () => {
    const original = window.matchMedia;
    window.matchMedia = (query: string) =>
      ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => false,
        onchange: null,
      }) as MediaQueryList;
    try {
      renderWithMessages(<SponsorSlot ads={THREE} placement="hero" />);
      wait(12000);
      expect(shown()).toHaveAttribute("aria-label", "Banner 1 of 3");
    } finally {
      window.matchMedia = original;
    }
  });

  it("uses a rotation time of 5 seconds", () => {
    expect(SPONSOR_ROTATION_MS).toBe(5000);
  });
});
