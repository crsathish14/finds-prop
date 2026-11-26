import { describe, expect, it } from "vitest";
import { pickPages, pointsFor, type CandidateLink } from "../pick-pages";

const SITE = "https://www.kadalhomes.example";
const home = (path: string, text: string): CandidateLink => ({
  href: `https://www.kadalhomes.example${path}`,
  text,
  from: "home",
});

describe("UT-builder-research-pick: which pages are read for a question (owner's ranking, 27 Nov 2026)", () => {
  it("reads the builder's pages for the topic first, then the home page, then the best by points", () => {
    const picked = pickPages({
      topic: "delivery_record",
      website: SITE,
      builderPages: [
        { url: "https://kadalhomes.example/completed-projects", topic: "delivery_record" },
        { url: "https://kadalhomes.example/about", topic: "about_company" },
      ],
      candidates: [
        home("/about", "About Us"),
        home("/projects", "Our Projects"),
        home("/projects/completed", "Completed Projects"),
        home("/blog", "Blog"),
      ],
    });
    expect(picked).toEqual([
      { url: "https://kadalhomes.example/completed-projects", why: "builder_page" },
      { url: "https://www.kadalhomes.example/", why: "home_page" },
      { url: "https://www.kadalhomes.example/projects/completed", why: "points" },
      { url: "https://www.kadalhomes.example/projects", why: "points" },
    ]);
  });

  it("never reads a page with no topic word, another site's page or a file, and stops at five", () => {
    const picked = pickPages({
      topic: "projects",
      website: SITE,
      builderPages: [],
      candidates: [
        home("/blog", "Blog"),
        { href: "https://portal.example/projects", text: "Projects", from: "home" },
        home("/brochure-projects.pdf", "Projects brochure"),
        home("/projects/ongoing", "Ongoing projects"),
        home("/projects/upcoming", "Upcoming projects"),
        home("/projects/completed", "Completed projects"),
        home("/projects", "Projects"),
        home("/portfolio", "Portfolio"),
      ],
    });
    expect(picked).toHaveLength(5);
    expect(picked.map((page) => page.url)).not.toContain("https://www.kadalhomes.example/blog");
    expect(picked.some((page) => page.url.includes("portal.example"))).toBe(false);
    expect(picked.some((page) => page.url.endsWith(".pdf"))).toBe(false);
  });

  it("gives more points to the link's words than its address, and a little to a menu link and a short address", () => {
    expect(pointsFor(home("/x", "Completed projects"), ["completed"])).toBe(3 + 1 + 1);
    expect(pointsFor(home("/completed", "Go"), ["completed"])).toBe(2 + 1 + 1);
    expect(
      pointsFor(
        { href: "https://www.kadalhomes.example/a/b/completed", text: "", from: "sitemap" },
        ["completed"],
      ),
    ).toBe(2);
    expect(pointsFor(home("/steam", "Steam"), ["team"])).toBe(0);
  });

  it("answers a general question with the builder's pages, the home page, and the best About and Projects pages", () => {
    const picked = pickPages({
      topic: "general",
      website: SITE,
      builderPages: [{ url: "https://kadalhomes.example/awards", topic: "awards_approvals" }],
      candidates: [
        home("/about-us", "About Us"),
        home("/projects", "Projects"),
        home("/contact", "Contact"),
      ],
    });
    expect(picked.map((page) => page.why)).toEqual([
      "builder_page",
      "home_page",
      "points",
      "points",
    ]);
    expect(picked.map((page) => page.url)).toContain("https://www.kadalhomes.example/about-us");
    expect(picked.map((page) => page.url)).toContain("https://www.kadalhomes.example/projects");
  });
});
