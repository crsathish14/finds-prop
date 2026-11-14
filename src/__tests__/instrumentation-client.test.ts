import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("browser entry (CSP: no eval)", () => {
  it("loads the zod jitless setting before any module that parses a schema", () => {
    const source = readFileSync(new URL("../instrumentation-client.ts", import.meta.url), "utf8");
    const imports = [...source.matchAll(/^import\s+(?:[^"']*from\s+)?["']([^"']+)["']/gm)].map(
      (match) => match[1],
    );
    // public-env.ts parses a schema while it loads; a schema built before jitless is set probes
    // `Function("")`, which the content security policy refuses and the e2e CSP check reports.
    expect(imports[0]).toBe("@/lib/zod-jitless");
    expect(imports).toContain("@/lib/public-env");
  });
});
