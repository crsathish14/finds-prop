import { afterAll, describe, expect, it } from "vitest";
import { scanBundle, serverVariableNames } from "../check-client-bundle.mjs";
import { cleanupTrees, makeTree, rules } from "./helpers.mjs";

afterAll(cleanupTrees);

const ENV_MODULE =
  "const s = z.object({\n  APP_ENV: z.string(),\n  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),\n  MSG91_AUTH_KEY: z.string().optional(),\n});\n";

const tree = (staticFiles) =>
  makeTree(
    {
      "src/server/env.ts": ENV_MODULE,
      ...Object.fromEntries(Object.entries(staticFiles).map(([k, v]) => [`.next/static/${k}`, v])),
    },
    { withPolicy: false },
  );

describe("G-09 check-client-bundle", () => {
  it("reads the server variable names from the env module", () => {
    expect(serverVariableNames(tree({}))).toEqual([
      "APP_ENV",
      "SUPABASE_SERVICE_ROLE_KEY",
      "MSG91_AUTH_KEY",
    ]);
  });

  it("passes a clean client bundle", () => {
    expect(
      scanBundle({ root: tree({ "chunks/app.js": "console.log('hello')" }), env: {} }),
    ).toEqual([]);
  });

  it("fails when a server-only variable name is in the client bundle", () => {
    expect(
      rules(
        scanBundle({ root: tree({ "chunks/app.js": "const k = 'MSG91_AUTH_KEY';" }), env: {} }),
      ),
    ).toContain("BUNDLE-NAME");
    expect(
      rules(scanBundle({ root: tree({ "chunks/app.js": "role: 'service_role'" }), env: {} })),
    ).toContain("BUNDLE-NAME");
  });

  it("fails when the value of a server secret is in the client bundle", () => {
    const secret = "sb_secret_0123456789abcdefghij"; // gitleaks:allow (fake value for the scanner test)
    const result = scanBundle({
      root: tree({ "chunks/app.js": `fetch('${secret}')` }),
      env: { MSG91_AUTH_KEY: secret },
    });
    expect(rules(result)).toContain("BUNDLE-VALUE");
  });

  it("reports a missing build output", () => {
    const root = makeTree({ "src/server/env.ts": ENV_MODULE }, { withPolicy: false });
    expect(rules(scanBundle({ root, env: {} }))).toContain("BUNDLE-MISSING");
  });
});
