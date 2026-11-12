# ADR-127 · Fonts: IBM Plex Serif and IBM Plex Sans

- Status: Accepted (owner approved the plan on 11 Nov 2026)
- Date: 2026-11-11
- Supersedes: ADR-005 (Fraunces and Figtree)
- Related: DEC-01, R-TEST-06 (a baseline changes only on purpose)

## Decision

- **Headings use IBM Plex Serif; interface text uses IBM Plex Sans.** Both load through `next/font/google` and are self-hosted at build, exactly as ADR-005 decided. Noto Sans Tamil stays as the non-preloaded Tamil fallback.
- **Plex Serif is loaded at weights 400, 500 and 600, normal and italic.** 500 is the heading weight, 600 is the price on detail pages, and 400 italic is the copper emphasis word in a headline. The family is static (no variable file and no optical-size axis), so each weight is its own file.
- **Plex Sans is the variable file** (weight 100 to 700), so one file covers every interface weight.
- **Exposed as the same two tokens:** `--font-display` (Plex Serif, then Noto Sans Tamil, then Georgia, serif) and `--font-ui` (Plex Sans, then Noto Sans Tamil, then the system fonts). Noto Sans Tamil is now also in the heading stack, so a Tamil heading is no longer drawn in the browser's default font.
- **Why.** The owner wanted a more professional, trustworthy voice. Fraunces is a soft, decorative serif; Plex Serif and Plex Sans were designed together and read as sober and corporate.

## Consequences you should know

- **Every Design Lab baseline changes.** Text is on almost every page, so the screenshot step fails on the first CI run. The new images are compared with the UX render and then committed on their own, as `testing.md` describes (R-TEST-06). The 1% tolerance is not raised.
- **More font files.** Plex Serif adds up to six files where Fraunces needed two. Plex Sans stays at one. The real LCP cost is measured after the first CI run against the numbers in the LCP runbook; if it is noticeable, the italic file is the first thing to drop.
- **Text may wrap differently.** Plex letters have different widths from Fraunces and Figtree. The 390 px sideways-scroll check is the one to watch.
- **The written design is brought in line** (`docs/ux/final-ux/` and the documents that name the fonts), so the UX reference and the code agree.
