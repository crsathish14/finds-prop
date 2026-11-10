import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The editor and the list run in the browser. The forms feature's index also exports server-only code (its queries use
 * `server-only` and the cache), so a client file that imports a value from it cannot be built. Types are erased and are
 * fine. Vitest cannot see this, but the production build fails on it (it did, once).
 */
const CLIENT_FILES = ["form-editor.client.tsx", "forms-list.client.tsx", "form-draft.ts"];
const VALUE_IMPORT = /^import\s+(?!type\b)[^;]*?from\s+["']@\/features\/forms["']/ms;

describe("the form builder's browser files", () => {
  for (const file of CLIENT_FILES) {
    it(`${file} imports no value from the forms feature or the server`, () => {
      const text = readFileSync(join(__dirname, "..", file), "utf8");
      expect(text).not.toMatch(VALUE_IMPORT);
      expect(text).not.toMatch(/from\s+["']@\/server\//);
      expect(text).not.toMatch(/["']server-only["']/);
    });
  }
});
