# ADR-005 · Fonts via `next/font`

- Status: Accepted
- Date: 2026-10-29
- Related: Refined; approval: No; stage S2

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** Fraunces (variable, `opsz`, weights 400–700, italic) and Figtree (400–800) via `next/font/google` (self-hosted at build); Noto Sans Tamil as a non-preloaded fallback subset. Exposed as `--font-display`, `--font-ui`.
- **Benefit:** no render-blocking Google request; stable metrics; privacy.
