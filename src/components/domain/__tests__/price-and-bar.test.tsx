// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { PriceCard } from "../price-card";
import { StickyMobileBar } from "../sticky-mobile-bar";

describe("PriceCard: the price in the sticky column (S4-T01)", () => {
  it("shows the price and the price per square foot", () => {
    renderWithMessages(<PriceCard rupees={1_25_00_000} perSqftRupees={8_803} />);
    expect(screen.getByText("₹1.25 Cr")).toBeVisible();
    expect(screen.getByText("₹8,803 per sq.ft")).toBeVisible();
  });

  it("leaves out the price per square foot when it is not given", () => {
    renderWithMessages(<PriceCard rupees={78_00_000} />);
    expect(screen.getByText("₹78 L")).toBeVisible();
    expect(screen.queryByText(/per sq.ft/)).not.toBeInTheDocument();
  });

  it("shows a rent as a monthly price", () => {
    renderWithMessages(<PriceCard rupees={48_000} listingType="rent" />);
    expect(screen.getByText(/₹48,000/)).toBeVisible();
    expect(screen.getByText(/mo/)).toBeVisible();
  });

  it("draws the tags it is given above the price, and none when it has none", () => {
    const view = renderWithMessages(
      <PriceCard rupees={78_00_000} badges={<span>For sale</span>} />,
    );
    expect(screen.getByText("For sale")).toBeVisible();
    view.unmount();
    renderWithMessages(<PriceCard rupees={78_00_000} />);
    expect(screen.queryByText("For sale")).not.toBeInTheDocument();
  });
});

describe("StickyMobileBar: the bar at the bottom of a phone (S4-T01)", () => {
  it("shows the price and the price per square foot", () => {
    renderWithMessages(
      <StickyMobileBar
        rupees={1_25_00_000}
        perSqftRupees={8_803}
        action={{ label: "Enquire", onClick: () => undefined }}
      />,
    );
    expect(screen.getByText("₹1.25 Cr")).toBeVisible();
    expect(screen.getByText("₹8,803 per sq.ft")).toBeVisible();
  });

  it("is a link when the action has an address, such as the sign-in", () => {
    renderWithMessages(
      <StickyMobileBar
        rupees={1_25_00_000}
        action={{ label: "Sign in to enquire", href: "/auth?gate=enquire" }}
      />,
    );
    expect(screen.getByRole("link", { name: "Sign in to enquire" })).toHaveAttribute(
      "href",
      "/auth?gate=enquire",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("is a button that calls the page when the action has a handler, such as opening the sheet", async () => {
    const onClick = vi.fn();
    renderWithMessages(
      <StickyMobileBar rupees={1_25_00_000} action={{ label: "Enquire", onClick }} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Enquire" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("is pinned to the bottom below 1024 px and hidden from 1024 px", () => {
    renderWithMessages(
      <StickyMobileBar
        rupees={78_00_000}
        action={{ label: "Enquire", onClick: () => undefined }}
      />,
    );
    const bar = document.querySelector("[data-slot='sticky-mobile-bar']");
    expect(bar?.className).toContain("fixed");
    expect(bar?.className).toContain("bottom-0");
    expect(bar?.className).toContain("lg:hidden");
  });

  it("leaves room for a phone's home bar, as decoration", () => {
    renderWithMessages(
      <StickyMobileBar
        rupees={78_00_000}
        action={{ label: "Enquire", onClick: () => undefined }}
      />,
    );
    const spacer = document.querySelector("[data-slot='sticky-mobile-bar'] > [aria-hidden='true']");
    expect(spacer?.className).toContain("safe-area-inset-bottom");
  });

  it("has one copper button", () => {
    renderWithMessages(
      <StickyMobileBar
        rupees={78_00_000}
        action={{ label: "Enquire", onClick: () => undefined }}
      />,
    );
    expect(screen.getByRole("button", { name: "Enquire" }).className).toContain("bg-cta");
  });
});
