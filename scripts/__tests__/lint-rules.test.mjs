// Negative tests for gate G-02: every architectural rule must fail on a seeded violation, and the
// legitimate exceptions must still pass. The fixture feature folder is created and removed here.
import fs from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { repoRoot } from "../lib/core.mjs";

const FIXTURE_DIR = path.join(repoRoot, "src", "features", "zz-lint-fixture");
let eslint;

beforeAll(() => {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  fs.writeFileSync(path.join(FIXTURE_DIR, "index.ts"), "export const fixture = 1;\n");
  fs.writeFileSync(path.join(FIXTURE_DIR, "service.ts"), "export const secretInternal = 1;\n");
  eslint = new ESLint({ cwd: repoRoot });
}, 60_000);

afterAll(() => {
  fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
});

async function lint(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath: path.join(repoRoot, filePath) });
  return result.messages.map(
    (m) => `${m.ruleId ?? (m.fatal ? "fatal" : "directive")}: ${m.message}`,
  );
}
const has = (messages, ruleId, text = "") =>
  messages.some((m) => m.startsWith(`${ruleId}:`) && m.includes(text));

describe("G-02 lint: restricted syntax", () => {
  it("R-FE-06 rejects raw interactive elements in features and app", async () => {
    for (const tag of ["button", "input", "select", "textarea", "a"]) {
      const out = await lint(
        `export function X() { return <${tag} />; }\n`,
        "src/features/zz-lint-fixture/components/x.tsx",
      );
      expect(has(out, "no-restricted-syntax", "R-FE-06"), tag).toBe(true);
    }
    expect(
      has(
        await lint("export function X() { return <button />; }\n", "src/app/x/section.tsx"),
        "no-restricted-syntax",
        "R-FE-06",
      ),
    ).toBe(true);
  });

  it("allows raw elements inside the shared components folder", async () => {
    expect(
      has(
        await lint(
          "export function X() { return <button type='button' />; }\n",
          "src/components/ui/button.tsx",
        ),
        "no-restricted-syntax",
      ),
    ).toBe(false);
  });

  it("R-FE-01 rejects 'use client' outside *.client.tsx, allows it in client islands and Next error boundaries", async () => {
    const code = '"use client";\nexport function X() { return null; }\n';
    expect(
      has(
        await lint(code, "src/features/zz-lint-fixture/components/x.tsx"),
        "no-restricted-syntax",
        "R-FE-01",
      ),
    ).toBe(true);
    expect(
      has(await lint(code, "src/app/dashboard/panel.tsx"), "no-restricted-syntax", "R-FE-01"),
    ).toBe(true);
    expect(
      has(
        await lint(code, "src/features/zz-lint-fixture/components/x.client.tsx"),
        "no-restricted-syntax",
        "R-FE-01",
      ),
    ).toBe(false);
    expect(
      has(
        await lint(
          '"use client";\nexport default function E() { return null; }\n',
          "src/app/error.tsx",
        ),
        "no-restricted-syntax",
        "R-FE-01",
      ),
    ).toBe(false);
  });

  it("R-BE-01 rejects 'use server' outside actions.ts and non-defineAction exports in actions.ts", async () => {
    expect(
      has(
        await lint(
          '"use server";\nexport async function x() {}\n',
          "src/features/zz-lint-fixture/service.ts",
        ),
        "no-restricted-syntax",
        "R-BE-01",
      ),
    ).toBe(true);
    expect(
      has(
        await lint(
          '"use server";\nexport async function x() {}\n',
          "src/features/zz-lint-fixture/actions.ts",
        ),
        "no-restricted-syntax",
        "defineAction",
      ),
    ).toBe(true);
    expect(
      has(
        await lint(
          '"use server";\nexport const x = async () => 1;\n',
          "src/features/zz-lint-fixture/actions.ts",
        ),
        "no-restricted-syntax",
        "defineAction",
      ),
    ).toBe(true);
    expect(
      has(
        await lint(
          '"use server";\nconst defineAction = (c: unknown) => c;\nexport const x = defineAction({});\n',
          "src/features/zz-lint-fixture/actions.ts",
        ),
        "no-restricted-syntax",
      ),
    ).toBe(false);
  });

  it("R-BE-06 rejects select('*') and select() in queries", async () => {
    expect(
      has(
        await lint(
          "export const q = (db: any) => db.from('t').select('*');\n",
          "src/features/zz-lint-fixture/queries.ts",
        ),
        "no-restricted-syntax",
        "R-BE-06",
      ),
    ).toBe(true);
    expect(
      has(
        await lint(
          "export const q = (db: any) => db.from('t').select();\n",
          "src/features/zz-lint-fixture/queries.ts",
        ),
        "no-restricted-syntax",
        "R-BE-06",
      ),
    ).toBe(true);
    expect(
      has(
        await lint(
          "export const q = (db: { from: (t: string) => { select: (c: string) => unknown } }) => db.from('t').select('id, title');\n",
          "src/features/zz-lint-fixture/queries.ts",
        ),
        "no-restricted-syntax",
        "R-BE-06",
      ),
    ).toBe(false);
  });

  it("R-GEN-07 rejects process.env outside the env modules", async () => {
    expect(
      has(
        await lint(
          "export const x = process.env.FOO;\n",
          "src/features/zz-lint-fixture/service.ts",
        ),
        "no-restricted-syntax",
        "R-GEN-07",
      ),
    ).toBe(true);
    expect(
      has(
        await lint("export const x = process.env.FOO;\n", "src/server/env.ts"),
        "no-restricted-syntax",
        "R-GEN-07",
      ),
    ).toBe(false);
    expect(
      has(
        await lint("export const x = process.env.FOO;\n", "src/lib/public-env.ts"),
        "no-restricted-syntax",
        "R-GEN-07",
      ),
    ).toBe(false);
  });

  it("R-GEN-02 rejects enums", async () => {
    expect(
      has(
        await lint("export enum Color { Red }\n", "src/lib/x.ts"),
        "no-restricted-syntax",
        "R-GEN-02",
      ),
    ).toBe(true);
  });

  it("R-TEST-02 and R-TEST-03 reject focused tests and fixed waits", async () => {
    expect(
      has(
        await lint(
          "import { it } from 'vitest';\nit.only('x', () => {});\n",
          "src/lib/__tests__/x.test.ts",
        ),
        "no-restricted-syntax",
        "R-TEST-02",
      ),
    ).toBe(true);
    expect(
      has(
        await lint(
          "import { it } from 'vitest';\nit.skip('x', () => {});\n",
          "src/lib/__tests__/x.test.ts",
        ),
        "no-restricted-syntax",
        "R-TEST-02",
      ),
    ).toBe(true);
    expect(
      has(
        await lint(
          "export async function t(page: { waitForTimeout: (n: number) => Promise<void> }) { await page.waitForTimeout(500); }\n",
          "e2e/x.spec.ts",
        ),
        "no-restricted-syntax",
        "R-TEST-03",
      ),
    ).toBe(true);
  });
});

describe("G-02 lint: restricted imports", () => {
  it("R-BE-07 rejects the service-role client outside its allow-list", async () => {
    const code =
      "import { createAdminSupabase } from '@/server/supabase/admin.server';\nexport const x = createAdminSupabase;\n";
    expect(
      has(
        await lint(code, "src/features/zz-lint-fixture/service.ts"),
        "no-restricted-imports",
        "R-BE-07",
      ),
    ).toBe(true);
    expect(
      has(
        await lint(code, "src/features/zz-lint-fixture/queries.ts"),
        "no-restricted-imports",
        "R-BE-07",
      ),
    ).toBe(true);
    expect(has(await lint(code, "src/app/page.tsx"), "no-restricted-imports", "R-BE-07")).toBe(
      true,
    );
  });

  it("R-BE-07 allows the service-role client in the allow-listed modules", async () => {
    const code =
      "import { createAdminSupabase } from '@/server/supabase/admin.server';\nexport const x = createAdminSupabase;\n";
    expect(
      has(await lint(code, "src/features/forms/service.ts"), "no-restricted-imports", "R-BE-07"),
    ).toBe(false);
    expect(
      has(await lint(code, "src/features/builders/service.ts"), "no-restricted-imports", "R-BE-07"),
    ).toBe(false);
    expect(
      has(await lint(code, "src/server/rate-limit/limit.ts"), "no-restricted-imports", "R-BE-07"),
    ).toBe(false);
  });

  it("R-FE-13 rejects TanStack Query outside client islands", async () => {
    const code = "import { useQuery } from '@tanstack/react-query';\nexport const x = useQuery;\n";
    expect(
      has(
        await lint(code, "src/features/zz-lint-fixture/queries.ts"),
        "no-restricted-imports",
        "R-FE-13",
      ),
    ).toBe(true);
    expect(
      has(
        await lint(code, "src/features/zz-lint-fixture/components/x.client.tsx"),
        "no-restricted-imports",
        "R-FE-13",
      ),
    ).toBe(false);
  });
});

describe("G-02 lint: layer boundaries", () => {
  const rejected = (out) => has(out, "boundaries/dependencies");

  it("R-FE-02 rejects a client island importing server code", async () => {
    expect(
      rejected(
        await lint(
          "import { env } from '@/server/env';\nexport const x = env;\n",
          "src/features/zz-lint-fixture/components/x.client.tsx",
        ),
      ),
    ).toBe(true);
  });

  it("R-FE-03 rejects a deep import of another feature, allows its index and its own files", async () => {
    expect(
      rejected(
        await lint(
          "import { secretInternal } from '@/features/zz-lint-fixture/service';\nexport const x = secretInternal;\n",
          "src/features/other/queries.ts",
        ),
      ),
    ).toBe(true);
    expect(
      rejected(
        await lint(
          "import { fixture } from '@/features/zz-lint-fixture';\nexport const x = fixture;\n",
          "src/features/other/queries.ts",
        ),
      ),
    ).toBe(false);
    expect(
      rejected(
        await lint(
          "import { secretInternal } from './service';\nexport const x = secretInternal;\n",
          "src/features/zz-lint-fixture/queries.ts",
        ),
      ),
    ).toBe(false);
  });

  it("R-FE-03 rejects app code deep-importing a feature, allows its index", async () => {
    expect(
      rejected(
        await lint(
          "import { secretInternal } from '@/features/zz-lint-fixture/service';\nexport const x = secretInternal;\n",
          "src/app/page.tsx",
        ),
      ),
    ).toBe(true);
    expect(
      rejected(
        await lint(
          "import { fixture } from '@/features/zz-lint-fixture';\nexport const x = fixture;\n",
          "src/app/page.tsx",
        ),
      ),
    ).toBe(false);
  });

  it("R-FE-03 rejects shared components importing server code, features or app", async () => {
    expect(
      rejected(
        await lint(
          "import { env } from '@/server/env';\nexport const x = env;\n",
          "src/components/ui/button.tsx",
        ),
      ),
    ).toBe(true);
    expect(
      rejected(
        await lint(
          "import { fixture } from '@/features/zz-lint-fixture';\nexport const x = fixture;\n",
          "src/components/patterns/field.tsx",
        ),
      ),
    ).toBe(true);
  });

  it("R-FE-03 rejects server infrastructure importing features", async () => {
    expect(
      rejected(
        await lint(
          "import { fixture } from '@/features/zz-lint-fixture';\nexport const x = fixture;\n",
          "src/server/actions/x.ts",
        ),
      ),
    ).toBe(true);
  });

  it("allows the intended imports", async () => {
    expect(
      rejected(
        await lint(
          "import { env } from '@/server/env';\nexport const x = env;\n",
          "src/features/zz-lint-fixture/service.ts",
        ),
      ),
    ).toBe(false);
    expect(
      rejected(
        await lint(
          "import { publicEnv } from '@/lib/public-env';\nexport const x = publicEnv;\n",
          "src/server/supabase/browser.ts",
        ),
      ),
    ).toBe(false);
    expect(
      rejected(
        await lint(
          "import type { ActionResult } from '@/types/action';\nexport type X = ActionResult<number>;\n",
          "src/server/actions/x.ts",
        ),
      ),
    ).toBe(false);
  });
});

describe("G-02 lint: general rules", () => {
  it("rejects console, dangerouslySetInnerHTML and default exports outside Next special files", async () => {
    expect(
      has(await lint("export function x() { console.log(1); }\n", "src/lib/x.ts"), "no-console"),
    ).toBe(true);
    expect(
      has(
        await lint(
          "export function X() { return <div dangerouslySetInnerHTML={{ __html: 'x' }} />; }\n",
          "src/components/ui/x.tsx",
        ),
        "react/no-danger",
      ),
    ).toBe(true);
    expect(
      has(await lint("export default function x() {}\n", "src/lib/x.ts"), "no-restricted-exports"),
    ).toBe(true);
    expect(
      has(
        await lint("export default function Page() { return null; }\n", "src/app/about/page.tsx"),
        "no-restricted-exports",
      ),
    ).toBe(false);
  });

  it("rejects any, @ts-ignore and unused disable directives", async () => {
    expect(
      has(
        await lint("export const x: any = 1;\n", "src/lib/x.ts"),
        "@typescript-eslint/no-explicit-any",
      ),
    ).toBe(true);
    expect(
      has(
        await lint("// @ts-ignore\nexport const x: number = 'a';\n", "src/lib/x.ts"),
        "@typescript-eslint/ban-ts-comment",
      ),
    ).toBe(true);
    expect(
      has(
        await lint(
          "// eslint-disable-next-line no-console -- not needed here at all\nexport const x = 1;\n",
          "src/lib/x.ts",
        ),
        "directive",
        "Unused eslint-disable",
      ),
    ).toBe(true);
  });
});
