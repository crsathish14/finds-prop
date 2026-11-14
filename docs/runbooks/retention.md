# Retention: deleting old data every night

Old personal data and old bookkeeping rows are deleted by a job that runs by itself every night at 03:00 India time (21:30 UTC). Nothing needs setting up: the migration schedules it in every environment. This page is for checking it, running it by hand, stopping it and changing a window. The reasons are in ADR-124 (decision DEC-28).

## What it deletes

| What                                                           | Older than                                                                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Form submissions (`form_submissions`)                          | 12 months                                                                                                                     |
| CRM call log lines (`crm_api_logs`)                            | 12 months                                                                                                                     |
| Project events: views, shortlists and so on (`project_events`) | 12 months                                                                                                                     |
| Enquiries on listings (`enquiries`)                            | 24 months                                                                                                                     |
| Project leads (`project_leads`)                                | 24 months                                                                                                                     |
| Rate limit windows (`public_rate_limits`)                      | 7 days; the AI chat trial scopes `ai_chat_trial_cookie` and `ai_chat_trial_visitor` 400 days (a 366-day window plus a margin) |
| Repeat-request keys (`idempotency_keys`)                       | 24 hours                                                                                                                      |

It leaves alone: the audit log (never deleted), a submission that has an uploaded file, and a submission still waiting on a CRM delivery. Those two are counted every night (see "Check it") so they are not forgotten. One-time codes sent by text message are Supabase Auth's own rows and are not touched here.

The windows are provisional until counsel confirms them (DEC-28).

## Check it

Run these in the project's **SQL Editor** (dev first).

- The job exists and is on: `select jobname, schedule, active from cron.job where jobname = 'retention';` (the schedule is `30 21 * * *`).
- It ran, and how: `select status, return_message, start_time from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'retention') order by start_time desc limit 5;`. A `succeeded` line each day is what you want.
- What it deleted each night: `select at, diff from public.audit_log where action = 'retention.ran' order by at desc limit 7;`. The `diff` holds the number of rows deleted from each table and, under `skipped`, how many old submissions it left alone (`form_submissions_with_files` and `form_submissions_pending`). A `skipped` number that is not zero is worth a look: a pending submission older than a year was lost by the delivery engine.

## Run it now

`select public.run_retention();` in the SQL Editor. It answers with the same counts the log gets. To try it on a small scale first: `select public.run_retention(100, 1);` (at most 100 rows of each table). A run that meets the nightly one answers `{"busy": true}` and does nothing; try again a minute later.

Rows it deletes cannot be brought back.

## Stop it, and start it again

- Stop: `select cron.unschedule('retention');`. Nothing is deleted until it is started again, and old data stays in the database meanwhile.
- Start: `select cron.schedule('retention', '30 21 * * *', 'select public.run_retention()');`.

## Change a window

The windows are constants at the top of `public.run_retention()`. Never edit the migration that exists: write a new migration that replaces the function (`create or replace function`, with the same grants) with the new constant, add a line to ADR-124 and the table above, and let it go through the normal change. When counsel confirms or changes the DEC-28 windows, do it this way.
