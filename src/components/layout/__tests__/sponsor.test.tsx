// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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
