# ADR-020 · Design Lab instead of Storybook — **Approval required (`DEC-22`)**

- Status: Accepted
- Date: 2026-10-29
- Related: Proposed; approval: **Yes (`DEC-22`)**; stage S2

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** a dev-only route group (`/design-system/*`, `notFound()` in production, `noindex`) mirroring the five UX boards (`ds-foundations`, `ds-components`, `ds-navigation`, `ds-feedback`, `ds-ads`). Playwright takes screenshots and runs axe on it.
- **Why:** Storybook's support for React Server Components and Tailwind v4 on Next 16 would need its own spike and adds a second toolchain. The Design Lab uses the real app config.
- **Revisit:** if the team grows or isolated component docs become valuable.
