import { afterAll, describe, expect, it } from "vitest";
import { checkEnv } from "../check-env.mjs";
import { cleanupTrees, makeTree, rules } from "./helpers.mjs";

afterAll(cleanupTrees);

const SERVER =
  "export const schema = z.object({\n  APP_ENV: z.string(),\n  MSG91_AUTH_KEY: z.string().optional(),\n});\n";
const PUBLIC =
  "const schema = z.object({\n  NEXT_PUBLIC_SITE_URL: z.url(),\n});\nparse({\n  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,\n});\n";
const EXAMPLE = "APP_ENV=local\nMSG91_AUTH_KEY=\nNEXT_PUBLIC_SITE_URL=http://localhost:3000\n";

const run = (files) => {
  const tree = {
    "src/server/env.ts": SERVER,
    "src/lib/public-env.ts": PUBLIC,
    ".env.example": EXAMPLE,
    ...files,
  };
  const root = makeTree(tree, { withPolicy: false });
  return checkEnv({ root, files: Object.keys(tree) });
};

describe("G-15 check-env", () => {
  it("passes when schema and .env.example agree", () => {
    expect(run({})).toEqual([]);
  });

  it("fails when a schema variable is missing from .env.example", () => {
    expect(
      rules(run({ ".env.example": "APP_ENV=local\nNEXT_PUBLIC_SITE_URL=http://x\n" })),
    ).toContain("ENV-PARITY");
  });

  it("fails when .env.example has a variable the schema does not know", () => {
    const result = run({ ".env.example": `${EXAMPLE}EXTRA_KEY=1\n` });
    expect(
      result.some(
        (finding) => finding.rule === "ENV-PARITY" && finding.message.includes("EXTRA_KEY"),
      ),
    ).toBe(true);
  });

  it("fails when .env.example holds a secret-looking value", () => {
    expect(
      rules(
        run({
          ".env.example": EXAMPLE.replace(
            "MSG91_AUTH_KEY=",
            "MSG91_AUTH_KEY=aB3dE5gH7jK9mN1pQ3sT5vX7zA9cE1fG3hJ5kL7",
          ),
        }),
      ),
    ).toContain("ENV-SECRET");
  });

  it("fails when process.env is read outside the env modules", () => {
    expect(
      rules(run({ "src/features/a/service.ts": "const x = process.env.MSG91_AUTH_KEY;\n" })),
    ).toContain("ENV-PROCESS");
  });

  it("allows platform variables and test files", () => {
    expect(
      run({
        "src/features/a/x.ts": "const m = process.env.NODE_ENV;\n",
        "src/features/a/x.test.ts": "process.env.FOO = '1';\n",
      }),
    ).toEqual([]);
  });

  it("fails when an env module is missing", () => {
    const root = makeTree({ ".env.example": EXAMPLE }, { withPolicy: false });
    expect(rules(checkEnv({ root, files: [".env.example"] }))).toContain("ENV-MODULE");
  });
});
