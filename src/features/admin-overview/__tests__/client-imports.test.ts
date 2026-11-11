import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Overview page's island runs in the browser. The feature's index also exports server-only code (its queries use
 * `server-only` and the server's client), so a client file that imports a value from the index (its own or another
 * feature's), from the queries or from the server cannot be built. Types are erased and are fine. Vitest cannot see
 * this, but the production build fails on it (it did, once, in another feature).
 */
const CLIENT_FILES = ["admin-overview.client.tsx", "range.ts"];
const VALUE_IMPORT = /^import\s+(?!type\b)[^;]*?from\s+["']@\/features\/[a-z-]+["']/ms;
const SERVER_FILE = /^import\s+(?!type\b)[^;]*?from\s+["']\.\/(queries|index)["']/ms;

describe("the Overview page's browser files", () => {
  for (const file of CLIENT_FILES) {
    it(`${file} imports no value from a feature's index, the queries or the server`, () => {
      const text = readFileSync(join(__dirname, "..", file), "utf8");
      expect(text).not.toMatch(VALUE_IMPORT);
      expect(text).not.toMatch(SERVER_FILE);
      expect(text).not.toMatch(/from\s+["']@\/server\//);
      expect(text).not.toMatch(/["']server-only["']/);
    });
  }
});
