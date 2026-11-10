import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The CRM page runs in the browser. The CRM feature's index also exports server-only code (its queries use
 * `server-only` and the service client), and the sending code reaches for the network and the address lookup, so a
 * client file that imports a value from the index, from the server or from those files cannot be built. Types are
 * erased and are fine. Vitest cannot see this, but the production build fails on it (it did, once, in another feature).
 */
const CLIENT_FILES = ["crm-page.client.tsx", "crm-editor.client.tsx", "editor-draft.ts"];
const VALUE_IMPORT = /^import\s+(?!type\b)[^;]*?from\s+["']@\/features\/(crm|leads|forms)["']/ms;
const SERVER_FILE =
  /^import\s+(?!type\b)[^;]*?from\s+["']\.\/(send|safe-url|service|queries|delivery|integration-service|actions)["']/ms;

describe("the CRM page's browser files", () => {
  for (const file of CLIENT_FILES) {
    it(`${file} imports no value from a feature's index, a server file or the server`, () => {
      const text = readFileSync(join(__dirname, "..", file), "utf8");
      expect(text).not.toMatch(VALUE_IMPORT);
      expect(text).not.toMatch(SERVER_FILE);
      expect(text).not.toMatch(/from\s+["']@\/server\//);
      expect(text).not.toMatch(/["']server-only["']/);
    });
  }
});
