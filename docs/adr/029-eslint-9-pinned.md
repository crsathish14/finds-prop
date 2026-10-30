# ADR-029 · ESLint 9 is pinned until the Next.js config supports 10

- Status: Accepted
- Date: 2026-10-30
- Related: R-GEN-02, G-02

## Context

npm marks ESLint 9.x as no longer supported and ESLint 10 is the current release. `eslint-config-next` 16.4.3 depends on `eslint-plugin-import`, `eslint-plugin-jsx-a11y` and `eslint-plugin-react`, none of which declare ESLint 10 in their peer ranges. With ESLint 10 installed, `npm ls` reports invalid peer dependencies even though the scaffold lints cleanly.

## Decision

Pin ESLint to 9.39.5 (exact) and re-check at each Next.js minor. Move to ESLint 10 when the Next.js ESLint config and its bundled plugins declare support, in one dedicated pull request with the lint negative tests as the safety net (`scripts/__tests__/lint-rules.test.mjs`).

## Consequences

ESLint 9 receives only maintenance fixes. The risk is accepted because lint is a style and architecture gate, not a runtime dependency. Revisit trigger: `npm view eslint-config-next peerDependencies` lists `^10`.
