import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// UT-module-rule (ADR-143 section 8): a content module that is switched off must disappear from every place at
// once, so the switch is read in exactly one way. This test fails when a new place reads the `content_modules` setting
// itself, or when a public page of a module forgets to ask for it.

/** The source files of the app (not tests), as text, by path relative to `src`, with forward slashes. */
function sourceFiles(
  directory: string,
  root: string = directory,
): { file: string; text: string }[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(path, root);
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.(ts|tsx)$/.test(entry.name)) return [];
    return [{ file: relative(root, path).split(sep).join("/"), text: readFileSync(path, "utf8") }];
  });
}

const SOURCE = sourceFiles(join(process.cwd(), "src"));

/**
 * The files that may name the setting. Each is the setting's own definition, its merge with the defaults, its writer
 * (the admin switch), the route rule that the header and the footer both use (`chrome.ts`) and those two, which hand the
 * same three booleans to it.
 */
const MAY_NAME_THE_SETTING = new Set([
  "features/site/schemas.ts",
  "features/site/defaults.ts",
  "features/site/modules.ts",
  "features/site/chrome.ts",
  "features/site/public-header.tsx",
  "features/site/public-footer.tsx",
  "features/site-content/constants.ts",
  "features/site-content/content-service.ts",
]);

describe("UT-module-rule: one way to read a module switch (ADR-143 section 8)", () => {
  it("finds the source files", () => {
    expect(SOURCE.length).toBeGreaterThan(300);
  });

  it("no file outside the list reads the content_modules setting itself", () => {
    const readers = SOURCE.filter(({ text }) => text.includes("content_modules")).map(
      ({ file }) => file,
    );
    const stray = readers.filter((file) => !MAY_NAME_THE_SETTING.has(file));
    expect(
      stray,
      `read the switch with getContentModuleOn or isContentModuleOn instead: ${stray.join(", ")}`,
    ).toEqual([]);
    // the list stays honest: a file leaves it when it stops naming the setting
    for (const file of MAY_NAME_THE_SETTING) expect(readers, file).toContain(file);
  });

  it('the answer to "is it on" comes only from isContentModuleOn, in one place', () => {
    const definitions = SOURCE.filter(({ text }) =>
      /\.content_modules\s*\[/.test(text.replace(/\s+/g, " ")),
    ).map(({ file }) => file);
    expect(definitions).toEqual(["features/site/modules.ts"]);
  });

  it("the menus hand the switches to the one route rule, never a copy of the module list", () => {
    for (const file of ["features/site/public-header.tsx", "features/site/public-footer.tsx"]) {
      const text = SOURCE.find((source) => source.file === file)?.text ?? "";
      expect(text, file).toMatch(/settings\.content_modules/);
      expect(text, file).not.toMatch(/content_modules\.(blog|faq|careers)/);
    }
  });

  it("every public page of a module asks for the module before it reads anything, and never reads the setting", () => {
    const pages: Record<string, string> = {
      "app/[locale]/(public)/blog/page.tsx": "blog",
      "app/[locale]/(public)/blog/[slug]/page.tsx": "blog",
      "app/[locale]/(public)/faq/page.tsx": "faq",
      "app/[locale]/(public)/careers/page.tsx": "careers",
      "app/[locale]/(public)/careers/[slug]/page.tsx": "careers",
    };
    for (const [file, moduleName] of Object.entries(pages)) {
      const text = SOURCE.find((source) => source.file === file)?.text;
      expect(text, `${file} exists`).toBeDefined();
      const body = text ?? "";
      expect(body, file).toContain(`await requireContentModule("${moduleName}")`);
      // the first read of the page's data comes after the module check
      const check = body.indexOf("await requireContentModule(");
      const firstRead = body.search(/await (get[A-Z]\w*)\(/);
      expect(check, file).toBeGreaterThanOrEqual(0);
      expect(
        firstRead === -1 || check < firstRead || /generateMetadata/.test(body.slice(0, check)),
        file,
      ).toBe(true);
    }
  });

  it("the sitemap and the AI assistant's reads ask through getContentModuleOn for every module they list", () => {
    const sitemap = SOURCE.find(({ file }) => file === "features/sitemap/queries.ts")?.text ?? "";
    for (const moduleName of ["blog", "faq", "careers"]) {
      expect(sitemap, moduleName).toContain(`getContentModuleOn("${moduleName}")`);
    }
    const ai =
      SOURCE.find(({ file }) => file === "features/ai-chat/content-queries.ts")?.text ?? "";
    for (const moduleName of ["blog", "faq", "careers"]) {
      expect(ai, moduleName).toContain(`getContentModuleOn("${moduleName}")`);
    }
  });

  it("the page metadata of an article and of a job asks for the module too, so a hidden item leaves nothing in the 404 head", () => {
    for (const [file, moduleName] of [
      ["app/[locale]/(public)/blog/[slug]/page.tsx", "blog"],
      ["app/[locale]/(public)/careers/[slug]/page.tsx", "careers"],
    ] as const) {
      const text = SOURCE.find((source) => source.file === file)?.text ?? "";
      expect(text, file).toContain(`getContentModuleOn("${moduleName}")`);
    }
  });
});
