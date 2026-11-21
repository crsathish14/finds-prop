# ADR-146 · Content in Trash is purged after 30 days, and the pictures of purged articles are swept

- Status: Accepted (the window is the owner's choice in ADR-143 D3; the pictures' cleanup is a small, reversible decision recorded here)
- Date: 2026-11-21
- Related: ADR-143 (D3 and section 3 "Retention"), ADR-144 ("Status and delete": no client holds DELETE, "a later shared change purges old Trash"), ADR-124 (the nightly retention job), ADR-058 (the hourly media sweep), ADR-028 (the audit log), ADR-105 and ADR-115 (the `site-assets` uploads)
- Class: C1 (a migration that replaces the retention function, one new database function, a small addition to an existing internal route). No new route, package, environment value or visitor-facing text.

## Context

Blog articles and FAQ questions are deleted softly: Trash sets `deleted_at`, the row is hidden from visitors, and the admin can restore it. ADR-143 D3 says Trash is purged by the nightly retention job after 30 days, with its own audit entry. No client holds the `DELETE` privilege on these tables (ADR-144), so until this change nothing ever removed a trashed row.

An article also owns picture files in the public `site-assets` bucket under `blog/<article id>/` (the cover and the image blocks, ADR-144). Deleting the row does not delete the files, and SQL cannot: files belong to the Storage service, and deleting rows of `storage.objects` leaves the bytes behind or is refused (the same reason the photo sweep goes through the Storage API, ADR-058).

## Decision

1. **The retention function purges Trash.** `run_retention()` (ADR-124) hard-deletes rows of `faqs` and `blog_posts` whose `deleted_at` is more than 30 days old. The window is one named constant, `content_trash_keep`, at the top of the function with the other windows, and the tables are one list, `content_trash_tables`. A module with a Trash date joins by adding its table name to the list in a new migration that replaces the function (Careers' `job_postings` will be a one-line addition). The loop is the same batched delete as the other tables (5,000 rows a batch, at most 20 batches a night), written once with `format('%I')` over the constant list; no table name ever comes from a caller.
   - A row is purged only when `deleted_at` is set and older than the window. A row with no `deleted_at` is never touched, whatever its status or age. Because a trashed row is always a draft (a check says so), no published row can be purged either.
   - The function keeps its signature, its `security definer` and pinned `search_path`, and its grants: only the service role and the database's own job may run it (ADR-124). So no type changes for `run_retention`.
2. **Its own audit entry.** Every table that purged at least one row in a run gets one `content.purged` entry, recorded as the system, with entity type `content` and no entity id. Its `diff` holds exactly four things: `table`, `count`, `older_than_days` and `ids` (the purged rows' ids, at most 500; a longer list is cut and `count` still says how many). Never a title, question, answer, author or any other text. A run that purges nothing writes no `content.purged` entry. The nightly `retention.ran` entry also gains one count for each listed table (`faqs`, `blog_posts`).
3. **The pictures are swept, not purged inline.** A new function `orphan_blog_files(p_older_than_hours default 24, p_limit default 500)` lists files of the `site-assets` bucket whose name is exactly `blog/<uuid>/<file>`, which are old enough, and for which no `blog_posts` row has that uuid, trashed or not. It is service-role only. The hourly media sweep (`POST /api/internal/sweep-media`, ADR-058), which already runs with the service role and the job's token, calls it after the photo step and removes the listed files through the Storage API (`features/media/sweep.ts`). The route's answer gains a second number, `blogFilesRemoved`.

### Why this and not the alternatives

- **Not inline in the purge.** The retention job is a pg_cron job that runs only SQL; it has no address, token or Storage client (ADR-124: it "needs no address or token"). Giving it the ability to call the Storage API would make the nightly job depend on the site being reachable and on a second secret, and a failure would have to roll back or leave half a purge.
- **Not a queue table of paths.** Recording each purged article's files in a table the sweeper reads would be one more table, one more place to forget a row and one more cleanup, to get what the existing sweep's "no row means remove" rule already gives for free.
- **Stateless and self-healing.** The sweep asks "which files have no article?", so it needs no memory of what the purge did. If the sweep is off or fails for a week, the next run still finds every orphan. The same rule also removes uploads of an article that was never saved once they are a day old.
- **An article in Trash keeps its pictures.** Restoring it loses nothing: its row still exists, so its files are not orphans. They go only after the purge, which is irreversible by design.
- **Safe by shape.** Only names matching `blog/<uuid>/<file>` are ever listed; a sponsor picture, a stray file, a placeholder or any other bucket cannot be listed, whatever is in the table. The 24-hour age rule gives an editor who is mid-upload (the file arrives before the article is saved) a margin, the same as the photo sweep.

## Consequences you should know

- **Purged content cannot be recovered** except from Supabase's own backups until they expire; this is the window ADR-143 D3 chose. Restore is possible for 30 days.
- **The picture files go only when the media sweep runs.** The sweep is armed by the owner once per environment (`docs/runbooks/media-sweep.md`). Until it is armed, the files of purged articles stay in the bucket; nothing breaks and nothing public points at them (the article page is gone). Arming it later removes them all.
- **Retention is still counts-only in its own entry.** The ids live in the separate `content.purged` entry, which is the one place a purge can be traced to a row id.
- **Scheduled work is unchanged.** The job's name, its time (21:30 UTC) and the sweep's schedule are untouched.

## Verification

- A pgTAP test (`supabase/tests/content_trash_purge.test.sql`, 25 checks, runs in CI): a question or article trashed 31 or 45 days ago goes, one trashed 29 days ago stays, a published, draft or archived row that is not in Trash never goes however old; a limited run purges one batch and the next takes the rest; a `content.purged` entry is written for each table that purged something, as the system, with exactly `table`, `count`, `older_than_days` and `ids`, and none for a run that purged nothing; no title, question, answer or author appears in an entry; `retention.ran` still has one entry per run and the new counts; before the purge the files of an article in Trash are not listed, after it the files of the purged article are, and so are those of an upload that was never saved, but not a new file, a live article's file, a stray file, a sponsor file or a file in another bucket; the batch size and age caps work; a signed-in user and a visitor cannot run the job; only the service role can list orphan files. The existing retention and function-grant tests are updated for the new keys and the new function.
- Unit tests of the sweep (`features/media/__tests__/sweep.test.ts` and `sweep-handler.test.ts`): blog files are listed and removed in the same bounded batch after the photos, nothing is removed with a wrong or missing token, nothing is called when there is nothing to remove, and a failure in the blog step still leaves the photos removed and fails the run.
- `src/types/database.types.ts` gains the `orphan_blog_files` entry in the generated format.
- Rollback: not destructive until it runs. To stop purging, fix forward with a migration that restores the previous function body (`20261117120100_places_usage_retention.sql`), or `select cron.unschedule('retention');` to stop the whole job (the runbook). Purged rows stay deleted.
