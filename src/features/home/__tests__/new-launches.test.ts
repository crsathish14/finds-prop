import { describe, expect, it } from "vitest";
import { developerFromProjects, rankBuilders } from "../new-launches";

const rows = (...ids: string[]) => ids.map((builder_id) => ({ builder_id }));

describe("UT-home-rank-builders: which builders the section shows (BR-94)", () => {
  it("ranks a builder where its first project appears and counts all its projects", () => {
    expect(rankBuilders(rows("b", "a", "b", "c", "a", "b"))).toEqual([
      { builderId: "b", projectCount: 3 },
      { builderId: "a", projectCount: 2 },
      { builderId: "c", projectCount: 1 },
    ]);
  });

  it("stops at the number asked for, three by default", () => {
    expect(rankBuilders(rows("a", "b", "c", "d", "e"))).toHaveLength(3);
    expect(rankBuilders(rows("a", "b", "c"), 2)).toHaveLength(2);
  });

  it("gives nothing for no projects", () => {
    expect(rankBuilders([])).toEqual([]);
  });
});

const project = (overrides: Record<string, unknown> = {}) => ({
  slug: "kadal-vista",
  name: "Kadal Vista",
  builder_id: "builder-1",
  images: ["builder-1/p1/a.jpg", "builder-1/p1/b.jpg"],
  builders: { id: "builder-1", name: "Kadal Homes", description: "Coastal homes." },
  ...overrides,
});

describe("UT-home-developer: one developer card's facts from its projects", () => {
  it("takes the builder's facts from the first project and shows the first two projects", () => {
    const developer = developerFromProjects("builder-1", 7, [
      project(),
      project({ slug: "kadal-grove", name: "Kadal Grove", images: [] }),
      project({ slug: "kadal-third", name: "Kadal Third" }),
    ]);
    expect(developer).toEqual({
      builderId: "builder-1",
      name: "Kadal Homes",
      description: "Coastal homes.",
      projectCount: 7,
      projects: [
        { slug: "kadal-vista", name: "Kadal Vista", coverPath: "builder-1/p1/a.jpg" },
        { slug: "kadal-grove", name: "Kadal Grove", coverPath: null },
      ],
    });
  });

  it("uses no cover for a project with no pictures, or with an empty list of them", () => {
    const withNull = developerFromProjects("builder-1", 1, [project({ images: null })]);
    expect(withNull?.projects[0]?.coverPath).toBeNull();
  });

  it("leaves out rows that do not fit, and rows of another builder", () => {
    const developer = developerFromProjects("builder-1", 2, [
      { nonsense: true },
      project({ builder_id: "builder-2" }),
      project(),
    ]);
    expect(developer?.projects).toHaveLength(1);
    expect(developer?.projects[0]?.slug).toBe("kadal-vista");
  });

  it("is nothing when the builder has no usable project", () => {
    expect(developerFromProjects("builder-1", 3, [])).toBeNull();
    expect(developerFromProjects("builder-1", 3, [{ nonsense: true }])).toBeNull();
  });
});
