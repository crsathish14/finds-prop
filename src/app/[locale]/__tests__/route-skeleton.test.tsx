import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ aiSearch: false }));

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    throw new Error(`REDIRECT ${destination}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/features/site", () => ({
  getFeatureFlags: () => ({ aiSearch: flags.aiSearch, mapView: false, pgListings: false }),
}));

const appRoot = join(process.cwd(), "src", "app", "[locale]");

function pagesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return pagesUnder(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

/** The layouts that wrap a page, outermost first. */
function layoutsAbove(page: string): string[] {
  const segments = relative(appRoot, page).split(sep).slice(0, -1);
  const found: string[] = [];
  for (let depth = 0; depth <= segments.length; depth += 1) {
    try {
      found.push(readFileSync(join(appRoot, ...segments.slice(0, depth), "layout.tsx"), "utf8"));
    } catch {
      // This folder has no layout.
    }
  }
  return found;
}

// The home page is in the (public) group, so it gets the public header (S4-T06).
const OPEN_GROUP = /^(\(public\)|\(auth\)|page\.tsx$)/;
const AREA_GATE: [RegExp, string][] = [
  [/^\(account\)/, 'area="customer"'],
  [/^\(portal\)[\\/]admin/, 'area="admin"'],
  [/^\(portal\)[\\/]builder/, 'area="builder"'],
];

describe("UT-route-skeleton: no page is left unguarded (S3-T11)", () => {
  const pages = pagesUnder(appRoot).filter((page) => !page.includes("design-system"));
  const relativePages = pages.map((page) => relative(appRoot, page));

  it("finds the routes of plan 03 section 3.1", () => {
    expect(relativePages.length).toBeGreaterThanOrEqual(40);
  });

  for (const page of pages) {
    const name = relative(appRoot, page);
    it(`${name} is public, a sign-in page, or inside a group whose layout guards it`, () => {
      if (OPEN_GROUP.test(name)) return;
      const gate = AREA_GATE.find(([pattern]) => pattern.test(name));
      expect(gate, `${name} is in no known group`).toBeDefined();
      const guarded = layoutsAbove(page).some((layout) =>
        layout.includes(`<PageGate ${gate?.[1]}`),
      );
      expect(guarded, `${name} needs a layout with <PageGate ${gate?.[1]}>`).toBe(true);
    });
  }

  it("keeps the sign-in pages out of the guarded groups, so they cannot redirect to themselves", () => {
    for (const login of ["(auth)/auth", "(auth)/builder/login", "(auth)/admin/login"]) {
      expect(relativePages).toContain(join(login, "page.tsx"));
    }
    const loginInPortal = relativePages.some((name) =>
      /^\(portal\)[\\/](admin|builder)[\\/]login/.test(name),
    );
    expect(loginInPortal).toBe(false);
  });

  it("marks every private group as not for search engines", () => {
    for (const group of ["(account)", "(portal)", "(auth)"]) {
      const layout = readFileSync(join(appRoot, group, "layout.tsx"), "utf8");
      expect(layout).toMatch(/robots:\s*\{\s*index:\s*false/);
    }
  });
});

describe("UT-route-skeleton: behaviour of the special routes", () => {
  beforeEach(() => {
    flags.aiSearch = false;
  });

  it("sends /admin and /builder to their dashboards", async () => {
    const admin = (await import("../(portal)/admin/page")).default;
    const builder = (await import("../(portal)/builder/page")).default;
    expect(() => admin()).toThrow("REDIRECT /admin/dashboard");
    expect(() => builder()).toThrow("REDIRECT /builder/dashboard");
  });

  it("hides /ai-search while the flag is off and shows it when on", async () => {
    const page = (await import("../(public)/ai-search/page")).default;
    expect(() => page()).toThrow("NOT_FOUND");
    flags.aiSearch = true;
    expect(page()).toBeTruthy();
  });
});
