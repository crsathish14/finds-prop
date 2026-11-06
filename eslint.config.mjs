// Flat ESLint configuration. Every block implements named rules from docs/engineering
// (R-GEN, R-FE, R-BE, R-TEST) and is proven by the negative tests in scripts/__tests__/lint-rules.test.mjs.
//
// How ESLint merges blocks: when several blocks match a file, the LAST block that sets a rule
// replaces the earlier setting completely. So `no-restricted-syntax` and `no-restricted-imports`
// are written as ordered, complete lists per file category, from general to specific.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";
import { NAMING_RULES } from "./scripts/policy/naming-rules.mjs";

// Next.js special files must have a default export, and the error boundaries must be client components.
const NEXT_SPECIAL_FILES = [
  "src/app/**/{page,layout,loading,error,global-error,not-found,global-not-found,template,default}.tsx",
  "src/app/**/{opengraph-image,twitter-image,icon,apple-icon}.tsx",
  "src/app/**/{sitemap,robots,manifest}.ts",
  "src/i18n/request.ts", // next-intl requires a default export
];
const SRC_CODE = ["src/**/*.{ts,tsx}"];
const TEST_FILES = [
  "**/*.test.{ts,tsx,mjs}",
  "**/__tests__/**/*.{ts,tsx}",
  "e2e/**/*.ts",
  "tests/**/*.{ts,tsx}",
];

const syntax = (selector, message) => ({ selector, message });

// R-FE-06: shared components only, in features and app routes.
const RAW_ELEMENTS = syntax(
  "JSXOpeningElement[name.name=/^(button|input|select|textarea|a)$/]",
  "Use the shared component (Button, Input, NativeSelect, Textarea, Link) instead of a raw element. R-FE-06",
);
// R-FE-01: client directive only in *.client.tsx under app/ and features/.
const USE_CLIENT = syntax(
  "ExpressionStatement[directive='use client']",
  "'use client' belongs only in *.client.tsx leaf files (Next.js error boundaries excepted). R-FE-01",
);
// R-BE-01: server directive only in actions.ts.
const USE_SERVER = syntax(
  "ExpressionStatement[directive='use server']",
  "'use server' belongs only in actions.ts, and actions are built with defineAction. R-BE-01",
);
// R-GEN-02: no enums; use `as const` unions.
const NO_ENUM = syntax(
  "TSEnumDeclaration",
  "Do not use enum; use an `as const` object or a string union. R-GEN-02",
);
// R-FE-21 (ADR-035): visitor-facing text lives in src/i18n/messages/en.json, not in components.
// A string counts as text when it has a letter in any script (Latin, Tamil, ...); punctuation,
// numbers and symbols alone are fine. Text kept in plain variables is caught by the pseudo-language
// smoke test, not here.
const LETTER = "[A-Za-z\u00C0-\u1FFF\u2C00-\uFFFF]";
const TEXT_PROPS = "alt|title|aria-label|aria-description|aria-roledescription|placeholder|label";
const NO_LITERAL_TEXT_MESSAGE =
  "Visitor-facing text belongs in src/i18n/messages/en.json; use translate('key'). R-FE-21";
const NO_LITERAL_TEXT = [
  syntax(`JSXText[value=/${LETTER}/]`, NO_LITERAL_TEXT_MESSAGE),
  syntax(`JSXExpressionContainer > Literal[value=/${LETTER}/]`, NO_LITERAL_TEXT_MESSAGE),
  syntax(
    `JSXExpressionContainer > TemplateLiteral > TemplateElement[value.raw=/${LETTER}/]`,
    NO_LITERAL_TEXT_MESSAGE,
  ),
  syntax(
    `JSXAttribute[name.name=/^(${TEXT_PROPS})$/] > Literal[value=/${LETTER}/]`,
    NO_LITERAL_TEXT_MESSAGE,
  ),
  syntax(
    `VariableDeclarator[id.name='metadata'] Literal[value=/${LETTER}/]`,
    "Page titles and descriptions come from en.json through generateMetadata. R-FE-21",
  ),
];
// R-GEN-07: environment access only in the two env modules.
const NO_PROCESS_ENV = syntax(
  "MemberExpression[object.name='process'][property.name='env']",
  "Read environment variables only through src/server/env.ts or src/lib/public-env.ts. R-GEN-07",
);
// R-BE-06: explicit column lists.
const NO_SELECT_STAR = [
  syntax(
    "CallExpression[callee.property.name='select'][arguments.length=0]",
    "Name the columns you need; .select() without columns returns everything. R-BE-06",
  ),
  syntax(
    "CallExpression[callee.property.name='select'][arguments.0.value='*']",
    "Name the columns you need; .select('*') is banned. R-BE-06",
  ),
];
// R-BE-01: actions.ts exports only defineAction(...) results.
const ACTION_EXPORTS = [
  syntax(
    "ExportNamedDeclaration > FunctionDeclaration",
    "Export actions as `export const x = defineAction(...)`. R-BE-01",
  ),
  syntax(
    "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator:not([init.callee.name='defineAction'])",
    "Every export of actions.ts must be created with defineAction. R-BE-01",
  ),
];
// R-TEST-02 and R-TEST-03: no focused or skipped tests, no fixed waits.
const TEST_HYGIENE = [
  syntax(
    "CallExpression[callee.property.name=/^(only|skip|todo)$/]",
    "Do not commit .only, .skip or .todo tests; fix or delete the test with a reason. R-TEST-02",
  ),
  syntax(
    "CallExpression[callee.property.name='waitForTimeout']",
    "Wait for a condition, not for time. R-TEST-03",
  ),
];

// R-BE-07 and R-FE-13: restricted import patterns.
const ADMIN_CLIENT = {
  group: ["**/admin.server", "**/admin.server.ts"],
  message:
    "The service-role client is limited to the allow-listed modules in docs/engineering/security.md. R-BE-07",
};
const TANSTACK = {
  group: ["@tanstack/react-query"],
  message: "TanStack Query is used only inside client islands that need client caching. R-FE-13",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...tseslint.configs.strict,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    "src/types/database.types.ts",
    "docs/ux/**",
  ]),

  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
    settings: { "import/resolver": { typescript: { alwaysTryTypes: true } } },
  },

  // ---------------------------------------------------------------- general rules for all source
  {
    files: SRC_CODE,
    rules: {
      "no-console": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-expect-error": "allow-with-description",
          minimumDescriptionLength: 10,
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "separate-type-imports" },
      ],
      "react/no-danger": "error",
      "react/jsx-no-target-blank": "error",
      "@next/next/no-img-element": "error",
      "no-restricted-syntax": ["error", NO_ENUM, NO_PROCESS_ENV],
      "no-restricted-imports": ["error", { patterns: [ADMIN_CLIENT, TANSTACK] }],
    },
  },

  // ---------------------------------------------------------------- names are words (R-GEN-11)
  {
    files: ["**/*.{ts,tsx,mjs,mts}"],
    rules: NAMING_RULES,
  },

  // ---------------------------------------------------------------- default exports (R-GEN-04)
  {
    files: SRC_CODE,
    ignores: NEXT_SPECIAL_FILES,
    rules: {
      "no-restricted-exports": [
        "error",
        {
          restrictDefaultExports: {
            direct: true,
            named: true,
            defaultFrom: true,
            namedFrom: true,
            namespaceFrom: true,
          },
        },
      ],
    },
  },

  // ---------------------------------------------------------------- syntax rules by file category
  {
    // server infrastructure: no client or server directives, explicit selects
    files: ["src/server/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        NO_ENUM,
        NO_PROCESS_ENV,
        USE_CLIENT,
        USE_SERVER,
        ...NO_SELECT_STAR,
      ],
    },
  },
  {
    // pages, layouts, features: server components by default, shared components only
    files: ["src/app/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        NO_ENUM,
        NO_PROCESS_ENV,
        USE_CLIENT,
        USE_SERVER,
        RAW_ELEMENTS,
        ...NO_LITERAL_TEXT,
        ...NO_SELECT_STAR,
      ],
    },
  },
  {
    // client islands and Next.js error boundaries may carry 'use client'
    files: ["src/app/**/error.tsx", "src/app/global-error.tsx", "src/**/*.client.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        NO_ENUM,
        NO_PROCESS_ENV,
        USE_SERVER,
        RAW_ELEMENTS,
        ...NO_LITERAL_TEXT,
      ],
    },
  },
  {
    // shared components: raw elements are allowed here, literal text is not
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", NO_ENUM, NO_PROCESS_ENV, USE_SERVER, ...NO_LITERAL_TEXT],
    },
  },
  {
    // server actions: only defineAction exports, and the 'use server' directive is allowed here
    files: ["src/**/actions.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        NO_ENUM,
        NO_PROCESS_ENV,
        USE_CLIENT,
        ...NO_SELECT_STAR,
        ...ACTION_EXPORTS,
      ],
    },
  },
  {
    // the two env modules may read process.env
    files: ["src/server/env.ts", "src/lib/public-env.ts"],
    rules: { "no-restricted-syntax": ["error", NO_ENUM] },
  },

  // ---------------------------------------------------------------- restricted imports (R-BE-07, R-FE-13)
  {
    // allow-list for the service-role client; extending it is class C2
    files: [
      "src/server/supabase/admin.server.ts",
      "src/server/rate-limit/**/*.ts",
      "src/server/idempotency/**/*.ts",
      "src/server/audit/**/*.ts",
      "src/features/builders/service.ts",
      "src/features/forms/service.ts",
      "src/features/crm/service.ts",
      "src/features/media/service.ts",
      "src/features/projects/service.ts",
      "src/features/enquiries/service.ts",
      "src/app/api/internal/**/route.ts",
    ],
    rules: { "no-restricted-imports": ["error", { patterns: [TANSTACK] }] },
  },
  {
    // client islands may use TanStack Query
    files: ["src/**/*.client.tsx"],
    rules: { "no-restricted-imports": ["error", { patterns: [ADMIN_CLIENT] }] },
  },

  // ---------------------------------------------------------------- tests (R-TEST-02, R-TEST-03)
  {
    files: TEST_FILES,
    rules: {
      "no-restricted-syntax": ["error", NO_ENUM, ...TEST_HYGIENE],
      "no-restricted-imports": "off",
      "no-restricted-exports": "off",
    },
  },

  // ---------------------------------------------------------------- layer boundaries (R-FE-02, R-FE-03)
  {
    files: SRC_CODE,
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "app", pattern: "src/app" },
        { type: "feature", pattern: "src/features/*", capture: ["featureName"] },
        { type: "ui", pattern: "src/components/ui" },
        { type: "patterns", pattern: "src/components/patterns" },
        { type: "layout", pattern: "src/components/layout" },
        { type: "domain", pattern: "src/components/domain" },
        { type: "charts", pattern: "src/components/charts" },
        { type: "server", pattern: "src/server" },
        { type: "lib", pattern: "src/lib" },
        { type: "types", pattern: "src/types" },
        { type: "styles", pattern: "src/styles" },
        { type: "config", pattern: "src/config" },
      ],
      "boundaries/files": [
        { category: "client-island", pattern: "**/*.client.tsx" },
        {
          category: "server-only-file",
          pattern: ["**/queries.ts", "**/service.ts", "**/*.server.ts"],
        },
        { category: "test", pattern: ["**/*.test.{ts,tsx}", "**/__tests__/**"] },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          // The last matching policy wins, so general rules come first and exceptions after.
          policies: [
            {
              from: { element: { types: ["ui", "patterns", "layout", "domain", "charts"] } },
              disallow: { to: { element: { types: ["feature", "server", "styles", "app"] } } },
              message:
                "Shared components are presentational: no features, server code or app imports. R-FE-03",
            },
            {
              from: { element: { type: "ui" } },
              disallow: { to: { element: { types: ["patterns", "layout", "domain", "charts"] } } },
              message: "Atoms import only atoms, lib and types. R-FE-03",
            },
            {
              from: { element: { type: "server" } },
              disallow: {
                to: {
                  element: {
                    types: [
                      "ui",
                      "patterns",
                      "layout",
                      "domain",
                      "charts",
                      "feature",
                      "styles",
                      "app",
                    ],
                  },
                },
              },
              message:
                "server/ is infrastructure: it never imports UI, features or app code. R-FE-03",
            },
            {
              from: { element: { type: "lib" } },
              disallow: {
                to: {
                  element: {
                    types: [
                      "ui",
                      "patterns",
                      "layout",
                      "domain",
                      "charts",
                      "feature",
                      "server",
                      "styles",
                      "app",
                    ],
                  },
                },
              },
              message:
                "lib/ holds pure helpers and cannot import UI, features or server code. R-FE-03",
            },
            {
              from: { element: { type: "types" } },
              disallow: {
                to: {
                  element: {
                    types: [
                      "ui",
                      "patterns",
                      "layout",
                      "domain",
                      "charts",
                      "feature",
                      "server",
                      "styles",
                      "app",
                      "lib",
                    ],
                  },
                },
              },
              message: "types/ holds declarations only. R-FE-03",
            },
            {
              from: { element: { type: "feature" }, file: { categories: "server-only-file" } },
              disallow: {
                to: {
                  element: { types: ["ui", "patterns", "layout", "domain", "charts", "styles"] },
                },
              },
              message: "Server data files do not import UI components. R-FE-03",
            },
            {
              from: { element: { type: "feature" } },
              disallow: { to: { element: { types: ["styles", "app"] } } },
              message: "Features do not import app code or styles. R-FE-03",
            },
            // cross-feature imports go only through index.ts
            {
              from: { element: { type: "feature" } },
              disallow: { to: { element: { type: "feature" } } },
              message: "Import another feature only through its index.ts. R-FE-03",
            },
            {
              from: { element: { type: "feature" } },
              allow: {
                to: {
                  element: {
                    type: "feature",
                    captured: { featureName: "{{ from.element.captured.featureName }}" },
                  },
                },
              },
            },
            {
              from: { element: { type: "feature" } },
              allow: { to: { element: { type: "feature", fileInternalPath: "index.ts" } } },
            },
            // app reaches features only through index.ts
            {
              from: { element: { type: "app" } },
              disallow: { to: { element: { type: "feature" } } },
              message: "app/ imports a feature only through its index.ts. R-FE-03",
            },
            {
              from: { element: { type: "app" } },
              allow: { to: { element: { type: "feature", fileInternalPath: "index.ts" } } },
            },
            // client islands never import server-only files or server infrastructure
            {
              from: { file: { categories: "client-island" } },
              disallow: {
                to: [{ file: { categories: "server-only-file" } }, { element: { type: "server" } }],
              },
              message:
                "Client islands never import server/, *.server.ts, queries.ts or service.ts. R-FE-02",
            },
            // tests may import anything (last, so it wins)
            { from: { file: { categories: "test" } }, allow: { to: { element: { type: "*" } } } },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
