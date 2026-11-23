// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SponsorCinematicBanner } from "@/components/domain/sponsor-cinematic-banner";
import { SponsorShowcaseCard } from "@/components/domain/sponsor-showcase-card";
import type { SponsorAd } from "@/lib/sponsors";
import { STYLED_AD_A, STYLED_AD_B, STYLED_AD_C } from "@/lib/sponsors.fixtures";
import { renderWithMessages } from "../../../../tests/render-intl";
import { SponsorStyledFrame } from "../sponsor-styled-frame";

const SHOWCASE_WORDS = {
  viewProject: "View project",
  priceList: "Get price list",
  rera: "RERA registered",
  newTab: "(opens in a new tab)",
};
const CINEMATIC_WORDS = { upNext: "Up next", newTab: "(opens in a new tab)" };
const THREE = [STYLED_AD_A, STYLED_AD_B, STYLED_AD_C];

type Ready = SponsorAd & Required<Pick<SponsorAd, "brand" | "photo" | "showcase" | "cinematic">>;
const ready = (ad: SponsorAd) => ad as Ready;

describe("SponsorShowcaseCard (ADR-187)", () => {
  it("shows the project's facts, with View project and Get price list for one of our projects", () => {
    renderWithMessages(<SponsorShowcaseCard ad={ready(STYLED_AD_A)} words={SHOWCASE_WORDS} />);
    expect(screen.getByRole("heading", { name: "Lakeview Residences" })).toBeVisible();
    for (const fact of [
      "Sample Homes",
      "Sholinganallur, OMR, Chennai",
      "2 & 3 BHK",
      "1,120 to 1,640 sq ft",
      "Ready Dec 2027",
      "₹78 L onwards",
      "RERA registered",
    ]) {
      expect(screen.getByText(fact)).toBeVisible();
    }
    const view = screen.getByRole("link", { name: "View project" });
    expect(view).toHaveAttribute("href", "/projects/lakeview-residences");
    expect(view).not.toHaveAttribute("target");
    expect(screen.getByRole("link", { name: "Get price list" })).toHaveAttribute(
      "href",
      "/projects/lakeview-residences#enquiry",
    );
  });

  it("opens another site in a new tab, marked sponsored, with no price list button", () => {
    renderWithMessages(<SponsorShowcaseCard ad={ready(STYLED_AD_B)} words={SHOWCASE_WORDS} />);
    const view = screen.getByRole("link", { name: /^View project\s+\(opens in a new tab\)$/ });
    expect(view).toHaveAttribute("href", "https://samplebuilders.example/coastal-greens");
    expect(view).toHaveAttribute("target", "_blank");
    expect(view).toHaveAttribute("rel", "sponsored noopener");
    expect(screen.queryByRole("link", { name: /Get price list/ })).toBeNull();
    expect(screen.queryByText("RERA registered")).toBeNull();
  });
});

describe("SponsorCinematicBanner (ADR-187)", () => {
  it("lays the headline, the line and the button on the photo, and names the next sponsor", () => {
    renderWithMessages(
      <SponsorCinematicBanner
        ad={ready(STYLED_AD_A)}
        next={{ brand: "Sample Builders", photo: ready(STYLED_AD_B).photo }}
        words={CINEMATIC_WORDS}
      />,
    );
    expect(screen.getByRole("heading", { name: "Homes that open onto the lake" })).toBeVisible();
    expect(screen.getByText("New launch · OMR")).toBeVisible();
    expect(screen.getByRole("link", { name: "Explore Lakeview" })).toHaveAttribute(
      "href",
      "/projects/lakeview-residences",
    );
    expect(screen.getByText("Up next")).toBeInTheDocument();
    expect(screen.getByText("Sample Builders")).toBeInTheDocument();
  });

  it("opens another site in a new tab, and leaves out what was not typed", () => {
    renderWithMessages(<SponsorCinematicBanner ad={ready(STYLED_AD_B)} words={CINEMATIC_WORDS} />);
    const link = screen.getByRole("link", {
      name: /^Visit Coastal Greens\s+\(opens in a new tab\)$/,
    });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "sponsored noopener");
    expect(screen.queryByText("Up next")).toBeNull();
  });
});

describe("SponsorStyledFrame (ADR-187)", () => {
  it("shows nothing at all with no ads", () => {
    const { container } = renderWithMessages(<SponsorStyledFrame ads={[]} style="showcase" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows one ad with the Sponsored label and no bars or buttons", () => {
    renderWithMessages(<SponsorStyledFrame ads={[STYLED_AD_A]} style="showcase" />);
    expect(screen.getByText("Sponsored")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "About this ad" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next sponsored banner" })).toBeNull();
    expect(document.querySelector(".sp-bar")).toBeNull();
  });

  it("draws the chosen style", () => {
    renderWithMessages(<SponsorStyledFrame ads={[STYLED_AD_A]} style="cinematic" />);
    expect(document.querySelector("[data-slot=sponsor-cinematic-banner]")).not.toBeNull();
    expect(document.querySelector("[data-slot=sponsor-showcase-card]")).toBeNull();
  });

  it("lets only the ad on show be reached, and the buttons move and announce", () => {
    renderWithMessages(<SponsorStyledFrame ads={THREE} style="showcase" />);
    const region = screen.getByRole("region", { name: "Sponsored banners" });
    expect(within(region).getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lakeview Residences" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Coastal Greens" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next sponsored banner" }));
    expect(within(region).getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Coastal Greens" })).toBeInTheDocument();
    expect(screen.getByText("Ad 2 of 3", { selector: "[aria-live]" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous sponsored banner" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous sponsored banner" }));
    expect(within(region).getByText("3 / 3")).toBeInTheDocument();
  });

  it("turns to the next ad when the bar of the ad on show is full, without announcing it", () => {
    renderWithMessages(<SponsorStyledFrame ads={THREE} style="showcase" />);
    const bars = document.querySelectorAll(".sp-bar");
    expect(Array.from(bars).map((bar) => bar.getAttribute("data-state"))).toEqual([
      "now",
      "waiting",
      "waiting",
    ]);
    const filling = document.querySelector(".sp-bar[data-state=now] .sp-bar-fill");
    if (!filling) throw new Error("no filling bar");
    // jsdom has no AnimationEvent, so React may listen under the prefixed name; send both.
    fireEvent.animationEnd(filling);
    fireEvent(filling, new Event("webkitAnimationEnd", { bubbles: true }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(
      Array.from(document.querySelectorAll(".sp-bar")).map((bar) => bar.getAttribute("data-state")),
    ).toEqual(["done", "now", "waiting"]);
    expect(document.querySelector("[aria-live]")).toHaveTextContent("");
  });

  it("waits while the pointer is over the ads", () => {
    renderWithMessages(<SponsorStyledFrame ads={THREE} style="showcase" />);
    const region = screen.getByRole("region", { name: "Sponsored banners" });
    fireEvent.mouseEnter(region);
    expect(region).toHaveAttribute("data-sponsor-paused");
    fireEvent.mouseLeave(region);
    expect(region).not.toHaveAttribute("data-sponsor-paused");
  });
});
