// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { FeaturedProjectCard, type FeaturedProjectCardData } from "../featured-project-card";

const PROJECT: FeaturedProjectCardData = {
  href: "/projects/lakeview-residences",
  name: "Lakeview Residences",
  developerName: "Sample Homes",
  developerLogo: null,
  locality: "Sholinganallur, OMR",
  bedrooms: [3, 2, 3],
  areaMinSqft: 1120,
  areaMaxSqft: 1640,
  priceRupees: 7_800_000,
  priceType: null,
  status: "new_launch",
  possession: "2027-12-01",
  rera: true,
  highlights: ["Clubhouse and pool", "Lake-facing walkway"],
  photos: ["/a.jpg", "/b.jpg", "/c.jpg"],
  photoCount: 7,
};

describe("FeaturedProjectCard (ADR-192)", () => {
  it("says it is a featured, sponsored project and shows the builder's details", () => {
    renderWithMessages(<FeaturedProjectCard project={PROJECT} />);
    expect(screen.getByText("Featured project")).toBeVisible();
    expect(screen.getByText("Sponsored")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Lakeview Residences" })).toBeVisible();
    for (const text of [
      "Sample Homes",
      "Sholinganallur, OMR",
      "2, 3 BHK",
      "1,120 sq.ft to 1,640 sq.ft",
      "RERA registered",
      "Clubhouse and pool",
      "Lake-facing walkway",
      "+4 photos",
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    // the third highlight is the possession month, after the two amenities
    expect(screen.getByText(/^Possession /)).toBeInTheDocument();
    // the developer's initials stand in for a missing logo
    expect(screen.getByText("SH")).toBeInTheDocument();
  });

  it("opens the project's enquiry form and its page, on our own site", () => {
    renderWithMessages(<FeaturedProjectCard project={PROJECT} />);
    const callBack = screen.getByRole("link", { name: "Request a call back" });
    expect(callBack).toHaveAttribute("href", "/projects/lakeview-residences#enquiry");
    expect(callBack).not.toHaveAttribute("target");
    expect(screen.getByRole("link", { name: "View project" })).toHaveAttribute(
      "href",
      "/projects/lakeview-residences",
    );
  });

  it("leaves out what the builder did not give", () => {
    renderWithMessages(
      <FeaturedProjectCard
        project={{
          ...PROJECT,
          developerLogo: "/logo.png",
          bedrooms: [],
          areaMinSqft: null,
          areaMaxSqft: null,
          priceRupees: null,
          status: null,
          possession: null,
          rera: false,
          highlights: [],
          photos: [],
          photoCount: 0,
        }}
      />,
    );
    expect(screen.queryByText("RERA registered")).toBeNull();
    expect(screen.queryByText(/BHK/)).toBeNull();
    expect(screen.queryByText(/photos/)).toBeNull();
    expect(screen.queryByText("SH")).toBeNull();
    expect(screen.getByRole("heading", { name: "Lakeview Residences" })).toBeVisible();
  });
});
