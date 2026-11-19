import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The switch islands run in the browser. The feature's index also exports server-only code (its queries use
 * `server-only` and the server's client), and `view.ts` reads the site feature's index, so a client file that imports
 * a value from an index, from the queries, from the view or from the server cannot be built. Types are erased and are
 * fine. Vitest cannot see this, but the production build fails on it.
 */
const CLIENT_FILES = [
  "content-modules-section.client.tsx",
  "content-module-page-bar.client.tsx",
  "switches.client.tsx",
];
const VALUE_IMPORT = /^import\s+(?!type\b)[^;]*?from\s+["']@\/features\/[a-z-]+["']/ms;
const SERVER_FILE = /^import\s+(?!type\b)[^;]*?from\s+["']\.\/(queries|index|view)["']/ms;

describe("the content module switches' browser files", () => {
  for (const file of CLIENT_FILES) {
    it(`${file} imports no value from a feature's index, the queries, the view or the server`, () => {
      const text = readFileSync(join(__dirname, "..", file), "utf8");
      expect(text).not.toMatch(VALUE_IMPORT);
      expect(text).not.toMatch(SERVER_FILE);
      expect(text).not.toMatch(/from\s+["']@\/server\//);
      expect(text).not.toMatch(/["']server-only["']/);
    });
  }
});
