# ADR-031 · Approved weak-copyleft packages and install scripts

- Status: Accepted
- Date: 2026-10-30
- Related: R-DEP-04, R-DEP-05, G-11

## Context

`scripts/check-deps.mjs` fails on any licence outside the permissive list and on any package with an install script that is not approved by name. The Stage 1 lockfile contains a few unavoidable exceptions.

## Decision

Weak copyleft approved by name: `axe-core` and `@axe-core/*` (MPL-2.0, accessibility testing, development only), `lightningcss*` (MPL-2.0, used by Tailwind CSS to build styles), `@img/sharp-*` (LGPL-3.0-or-later native image libraries used by next/image, dynamically linked and unmodified). Install scripts approved by name: `fsevents` (macOS file watching), `lefthook` (installs git hooks locally), `unrs-resolver` (ships prebuilt binaries; the script only validates them). Added 31 Oct 2026 with ADR-035 (owner approved): `@swc/core` (its postinstall only checks that the native binary loads, else falls back to WebAssembly) and `@parcel/watcher` (builds from source only when `npm_config_build_from_source=true`); both are used only by the optional next-intl message extractor, which we do not use. All approvals live in `scripts/policy/licences.json`.

## Consequences

Strong copyleft (GPL, AGPL, SSPL, BUSL) and unknown licences fail the build. A new weak-copyleft package or install script needs a change to `licences.json` with a reason (class C2, `Gate-change:` line). CI installs with `--ignore-scripts`, so none of these scripts run there.
