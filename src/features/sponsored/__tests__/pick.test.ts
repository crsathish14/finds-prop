import { describe, expect, it } from "vitest";
import { inArea, pickFeatured } from "../pick";

const projects = [
  { slug: "lake", locality: "Sholinganallur, OMR" },
  { slug: "sea", locality: "ECR" },
  { slug: "town", locality: "Velachery" },
];

describe("UT-featured-pick: which sponsored project the Featured card shows (ADR-192)", () => {
  it("matches an area by the locality, either naming the other, ignoring case and punctuation", () => {
    expect(inArea("Sholinganallur, OMR", "omr")).toBe(true);
    expect(inArea("OMR", "Sholinganallur OMR")).toBe(true);
    expect(inArea("Velachery", "velachery")).toBe(true);
    expect(inArea("ECR", "Adyar")).toBe(false);
    expect(inArea("", "Adyar")).toBe(false);
    expect(inArea("Adyar", " ")).toBe(false);
  });

  it("shows a project in the searched area when there is one", () => {
    expect(pickFeatured(projects, "OMR", () => 0.99)?.slug).toBe("lake");
    expect(pickFeatured(projects, "Velachery", () => 0)?.slug).toBe("town");
  });

  it("picks among all of them by chance when none is in the area, or no area was searched", () => {
    expect(pickFeatured(projects, "Adyar", () => 0)?.slug).toBe("lake");
    expect(pickFeatured(projects, undefined, () => 0.5)?.slug).toBe("sea");
    expect(pickFeatured(projects, undefined, () => 0.999)?.slug).toBe("town");
  });

  it("shows the only one there is, and nothing with none", () => {
    expect(
      pickFeatured([projects[1] as (typeof projects)[number]], undefined, () => 0.7)?.slug,
    ).toBe("sea");
    expect(pickFeatured([], "OMR", () => 0)).toBeNull();
  });
});
