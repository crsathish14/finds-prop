// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SHARE_CARD_COLORS, ShareCard } from "./share-card";

const tokens = fs.readFileSync(path.join(__dirname, "tokens.css"), "utf8");
const primitive = (name: string) =>
  new RegExp(`--p-${name}:\\s*(#[0-9a-fA-F]{6});`).exec(tokens)?.[1]?.toLowerCase();

describe("UT-share-card: the default share image's colours", () => {
  it("are the brand's own primitives in tokens.css, so the card cannot drift from the site", () => {
    expect(SHARE_CARD_COLORS).toEqual({
      background: primitive("forest-950"),
      ink: primitive("ivory-50"),
      muted: primitive("mist-300"),
      accent: primitive("copper-400"),
    });
  });

  it("draws the name, with its last word set apart, and the tagline it is given", () => {
    const { container } = render(
      <ShareCard name="Find Prop" tagline="Find homes in Tamil Nadu." />,
    );
    expect(container.textContent).toContain("Find");
    expect(container.querySelector("span")?.textContent).toBe("Prop");
    expect(container.textContent).toContain("Find homes in Tamil Nadu.");
  });

  it("draws the arch mark", () => {
    const { container } = render(<ShareCard name="Find Prop" tagline="Tagline" />);
    expect(container.querySelector("svg path")).not.toBeNull();
  });
});
