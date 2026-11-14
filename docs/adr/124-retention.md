# ADR-124 · Retention: old personal data is deleted every night (S7-T12, part 2)

- Status: Accepted (the windows are provisional until counsel confirms them, as DEC-28 says)
- Date: 2026-11-11
- Related: ADR-123 (the audit coverage review, part 1), ADR-028 (the audit log), ADR-058 and ADR-116 (the other scheduled jobs), DEC-28, NFR-07, FR-SYS-06, BR-44
- Plan for S7-T12 approved by the owner on 11 Nov 2026 ("approved"), with the windows and defaults below.

## Decision

- **One database function, `run_retention(p_batch default 5000, p_max_batches default 20)`, deletes what is old,** and a pg_cron job named `retention` runs it every night at 03:00 India time (21:30 UTC). It is a definer function with a pinned `search_path`; only the service role and the database's own job may run it (no execute for the public, visitors or signed-in users). It needs no address or token, so unlike the CRM retry (ADR-116) it is scheduled by the migration itself.
- **The windows (DEC-28, provisional).** They are constants at the top of the function; changing one is a new migration and a line here, so the history of the windows is the repository's.

  | Table                | Kept for  | Why                                                                                               |
  | -------------------- | --------- | ------------------------------------------------------------------------------------------------- |
  | `form_submissions`   | 12 months | DEC-28: submissions                                                                               |
  | `crm_api_logs`       | 12 months | DEC-28: logs                                                                                      |
  | `project_events`     | 12 months | plan 06: "aged `project_events`"                                                                  |
  | `enquiries`          | 24 months | DEC-28                                                                                            |
  | `project_leads`      | 24 months | not in DEC-28; they hold the same personal data as enquiries, so the same window (owner approved) |
  | `public_rate_limits` | 7 days    | DEC-28: rate-limit rows                                                                           |
  | `idempotency_keys`   | 24 hours  | the table's own 24 hour sweep                                                                     |
  | `ai_usage_events`    | 12 months | AI chat usage, no text (ADR-128, AI-P4-T05)                                                       |

- **Left alone, on purpose.**
  - **The audit log** is never pruned: it is append-only and holds no personal data (ADR-028, ADR-123). A rule for it needs its own decision.
  - **A submission with an uploaded file,** because the file in storage needs its own step to be deleted, and uploads are off in v1 (the owner skipped them), so none exists yet. Such rows are counted as skipped every night so they are not forgotten; the day uploads are switched on, the deleting of the files comes with that feature.
  - **A submission still waiting on a CRM delivery** (`crm_status = 'pending'`). One that is still pending after 12 months has been lost by the delivery engine; it stays, and the nightly count shows it, so someone looks at it instead of the failure being deleted with it. (The retry schedule gives up after six attempts, so this should stay at zero.)
  - **One-time codes** sent by text message are Supabase Auth's own rows, not ours; DEC-28's 7 days for them is Supabase's setting, not a job here.
- **Small batches.** Each table is deleted in batches of 5000 rows (at most 20 batches a night, so up to 100,000 rows a table), so a run never holds a table for long; what is left is taken the next night. A run that starts while another is still going (a manual one meeting the nightly one) leaves at once.
- **Every run is recorded.** One `retention.ran` entry per run, as the system, holding the number of rows deleted from each table and the number left alone, and nothing else (no id, name, number or message). The entry is also the way to see that the job ran.
- **Types.** `src/types/database.types.ts` gains the function's entry, written by hand in the generated format (no local database to generate it from); CI's database check compares it. The return type is `Json`.

## Consequences you should know

- **Leads and enquiries older than 24 months disappear from the admin's, the builders' and the owners' lists,** and the admin's Overview totals count only what is left. Nothing in the app keeps a copy.
- **A project whose only leads have aged out can be deleted** (BR-44 blocks the deletion only while leads exist). The deletion is still audited.
- **The deleted rows cannot be recovered** by design (they are personal data past their window). Hosted backups hold them until their own expiry; that is a Supabase setting, not part of this change.
- **The windows are provisional.** DEC-28 says to confirm them with counsel; when they are confirmed or changed, the new migration changes the constants and this ADR gets a line.

## Verification

- One migration (`20261111110000_retention.sql`) and its pgTAP test (`retention.test.sql`, 18 checks, which runs in CI): a limited run deletes at most one batch of each table and counts what it leaves alone; a second run in batches of one takes the rest; a rerun deletes nothing; only the new rows, the submission with a file and the one waiting on a delivery are left; every run writes one entry, as the system, with counts only and no id; an old audit entry is not pruned; a batch of no rows and no batches are refused; a signed-in user and a visitor cannot run it; only the service role may; it runs as its owner; the job is scheduled for 21:30 UTC. Not tested: two runs at the same moment (the lock) needs two sessions at once, which the pgTAP runner does not have; the lock is one line of the function, `pg_try_advisory_xact_lock`.
- The runbook `docs/runbooks/retention.md` says how to check the job, run it now, stop it and start it again, and change a window.
- No app code, package, environment, CI or protected-file change.
- Rollback: `select cron.unschedule('retention');` stops it at once; `drop function public.run_retention(integer, integer);` removes it. Rows already deleted stay deleted.
