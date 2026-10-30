# ADR-015 · Media — **Approval required**

- Status: Accepted
- Date: 2026-10-29
- Related: Proposed; approval: **Yes**; stage S6

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Buckets (created by migration, with limits on the bucket):** `listing-photos` (public read; WebP/JPEG/PNG; 10 MB), `project-media` (public read; jpg/png/webp/pdf; 10 MB), `form-uploads` (private; PDF/JPG/PNG/DOC/DOCX; 5 MB), `site-assets` (public read; admin write; JPG/PNG/WEBP only, **no SVG**).
- **Flow:** (1) action authorises and returns a signed upload URL to a path `<owner>/<listing>/<uuid>.<ext>`; (2) browser uploads the **already resized, EXIF-stripped** file; (3) a **finalize action** re-checks size/type/magic bytes with the service role, records dimensions, inserts `listing_media`; (4) a `pg_cron` sweeper deletes objects with no row after 24 h.
- **Delivery:** `next/image` with `remotePatterns` locked to the project's storage host and path; raise `minimumCacheTTL` for immutable UUID names; sizes/aspect ratios per UX.
- **Security trade-off (explicit):** public-read means pending-listing photos are reachable by anyone with the URL. URLs are unguessable and photos are intended for publication. Alternative (private + signed URLs) breaks CDN caching and `next/image`. Accepting this needs your approval.
- **Table:** `listing_media(id, listing_id, storage_path, mime, bytes, width, height, position, is_cover, alt_text, created_at)` replaces DEMO's `properties.images text[]`.
