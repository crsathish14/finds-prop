# ADR-004 · Tailwind v4 + shadcn/ui + token architecture

- Status: Accepted
- Date: 2026-10-29
- Related: Refined; approval: No (token names fixed to UX); stage S2

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Evidence:** ARC "themed from the UX tokens… `tokens.css` maps directly onto a Tailwind theme"; DEMO already uses Tailwind 4 + shadcn.
- **Decision:** `src/styles/tokens.css` is the **single source of truth** (primitive layer → UX semantic names such as `--c-primary`, `--s-4`, `--r-xl`). A `@theme inline` block maps them to Tailwind utilities. shadcn components are generated into `components/ui/` and **re-themed to Grove**; shadcn's own variable names (`--primary`, `--ring`, …) are _aliases_ of Grove semantics. **shadcn `--accent` must not be mapped to copper** (it denotes a muted hover surface); copper is exposed as `--color-cta`. UX breakpoints replace Tailwind defaults (no `sm`/`2xl`). Details in `04 §2`.
- **Trade-offs:** an alias layer exists solely to keep shadcn upgrades painless.
- **Risk:** low.
