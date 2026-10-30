# ADR-016 · Sponsored banners — **Approval required**

- Status: Accepted
- Date: 2026-10-29
- Related: Refined; approval: **Yes (`DEC-15/16`)**; stage S4

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** stored as JSON under `site_settings.sponsors` (ARC: banners are uploaded in the site-content editor). Shape and rules in `06 §11`. Selection is deterministic: `active` entries for the placement whose _format matches the live layout_; none → no-sponsor fallback. **No rotation, scheduling, billing or analytics** (brief). Ratio rule (cover ≤ ~8 %, letterbox ≤ ~30 %, reject beyond) applied at upload and re-checked at render.
- **Revisit trigger:** if scheduling or reporting is approved, migrate to an `ad_banners` table.
- **Security:** image types JPG/PNG/WEBP only; destination must be `https`; `rel="sponsored noopener"`.
