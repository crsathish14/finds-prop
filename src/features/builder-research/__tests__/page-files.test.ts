import { describe, expect, it } from "vitest";
import { pageTextOf } from "../page-text";
import { allowedByRobots } from "../robots";
import { onSameSite, siteOf } from "../site";
import { sitemapPages } from "../sitemap";

describe("UT-builder-research-site: the same-website rule", () => {
  it("treats www and no www as one site, and refuses http and other hosts", () => {
    expect(siteOf("https://WWW.KadalHomes.example/about")).toBe("kadalhomes.example");
    expect(onSameSite("https://kadalhomes.example/a", "https://www.kadalhomes.example")).toBe(true);
    expect(onSameSite("http://kadalhomes.example/a", "https://kadalhomes.example")).toBe(false);
    expect(onSameSite("https://shop.kadalhomes.example/a", "https://kadalhomes.example")).toBe(
      false,
    );
    expect(onSameSite("https://user:pass@kadalhomes.example/", "https://kadalhomes.example")).toBe(
      false,
    );
  });
});

describe("UT-builder-research-text: a page's words and links, nothing run", () => {
  const html = `<!doctype html><html><head><title>Kadal Homes &amp; Co</title><script>var x = "<p>hidden</p>"</script></head>
    <body><nav><a href="/about">About Us</a> <a href='projects/completed#top'>Completed <b>Projects</b></a>
    <a href="mailto:a@b.example">Mail</a><a href="#x">Top</a><a href="/about">Again</a></nav>
    <!-- a comment --><style>.x{}</style><h1>Since 1998</h1><p>Delivered 42 projects &mdash; on time.</p>
    <noscript>Turn on scripts</noscript></body></html>`;
  const page = pageTextOf(html, "https://kadalhomes.example/home/");

  it("keeps the title and the visible words, and drops scripts, styles, comments and noscript", () => {
    expect(page.title).toBe("Kadal Homes & Co");
    expect(page.text).toContain("Since 1998");
    expect(page.text).toContain("Delivered 42 projects - on time.");
    expect(page.text).not.toContain("hidden");
    expect(page.text).not.toContain("Turn on scripts");
    expect(page.text).not.toContain("comment");
  });

  it("lists each link once, made absolute, without fragments, mail or in-page links", () => {
    expect(page.links).toEqual([
      { href: "https://kadalhomes.example/about", text: "About Us" },
      { href: "https://kadalhomes.example/home/projects/completed", text: "Completed Projects" },
    ]);
  });
});

describe("UT-builder-research-robots: the site's robots.txt", () => {
  it("allows everything with no file, or with an empty Disallow", () => {
    expect(allowedByRobots(null, "/about")).toBe(true);
    expect(allowedByRobots("User-agent: *\nDisallow:", "/about")).toBe(true);
  });

  it("follows the group for every reader, the longest rule winning, Allow winning a tie", () => {
    const robots =
      "User-agent: *\nDisallow: /projects\nAllow: /projects/completed\nDisallow: /*.php$";
    expect(allowedByRobots(robots, "/projects/ongoing")).toBe(false);
    expect(allowedByRobots(robots, "/projects/completed")).toBe(true);
    expect(allowedByRobots(robots, "/index.php")).toBe(false);
    expect(allowedByRobots(robots, "/about")).toBe(true);
  });

  it("uses our own group when the site has one", () => {
    const robots = "User-agent: *\nAllow: /\n\nUser-agent: findsprop-assistant\nDisallow: /";
    expect(allowedByRobots(robots, "/about")).toBe(false);
  });
});

describe("UT-builder-research-sitemap: the site's sitemap.xml", () => {
  it("lists the same site's pages once, in order, and nothing from a sitemap index", () => {
    const xml = `<?xml version="1.0"?><urlset><url><loc>https://www.kadalhomes.example/about</loc></url>
      <url><loc> https://kadalhomes.example/projects?a=1&amp;b=2 </loc></url>
      <url><loc>https://other.example/x</loc></url><url><loc>https://kadalhomes.example/about</loc></url></urlset>`;
    expect(sitemapPages(xml, "https://kadalhomes.example")).toEqual([
      "https://www.kadalhomes.example/about",
      "https://kadalhomes.example/projects?a=1&b=2",
    ]);
    expect(
      sitemapPages(
        "<sitemapindex><sitemap><loc>https://kadalhomes.example/s.xml</loc></sitemap></sitemapindex>",
        "https://kadalhomes.example",
      ),
    ).toEqual([]);
  });
});
