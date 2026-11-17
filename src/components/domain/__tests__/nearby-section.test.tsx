// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { NearbySection } from "../nearby-section";

describe("NearbySection (ADR-131)", () => {
  it("is a region named by its heading, with the note that says why the homes are here", () => {
    renderWithMessages(
      <NearbySection place="Velachery" radiusKm={15} count={3}>
        <p>card</p>
      </NearbySection>,
    );
    const region = screen.getByRole("region", { name: "Also near Velachery" });
    expect(region).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Also near Velachery" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3 more homes within 15 km, nearest first.")).toBeInTheDocument();
  });

  it("says one home in the singular", () => {
    renderWithMessages(
      <NearbySection place="Adyar" radiusKm={10} count={1} view="list">
        <p>card</p>
      </NearbySection>,
    );
    expect(screen.getByText("1 more home within 10 km, nearest first.")).toBeInTheDocument();
  });

  it("holds the cards it is given", () => {
    renderWithMessages(
      <NearbySection place="Adyar" radiusKm={10} count={2}>
        <p>first card</p>
        <p>second card</p>
      </NearbySection>,
    );
    expect(screen.getByText("first card")).toBeInTheDocument();
    expect(screen.getByText("second card")).toBeInTheDocument();
  });
});
