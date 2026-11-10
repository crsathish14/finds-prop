# ADR-114 · The CRM delivery state machine in the database (S7-T09, part B1)

- Status: Accepted
- Date: 2026-11-10
- Related: ADR-113 (the connections and the sender), ADR-058 (the media sweep, the same job-and-token pattern), FR-ADM-09, FR-SYS-02, BR-66, BR-67
- Plan for S7-T09 part B approved by the owner on 10 Nov 2026 ("approved"): B1 is the database side, B2 the delivery engine, the retry route and the action. No UI and no new words in this change.

## Decision

- **The database decides who may be sent, and records the result.** Two functions, both for the service role alone (the retry route and the form actions call them; visitors and signed-in users have no execute grant).
- **`claim_crm_deliveries(limit, submission)` picks and leases.**
  - The sweep (no submission named) takes submissions that are due: pending for over a minute (the immediate send after a form is stored gets the first chance), or failed with a retry time that has come. Oldest first, at most `limit` (1 to 50).
  - A named submission is taken at once if it is pending or failed, whatever its retry time. That is both "send right after the form is stored" and the admin's "Retry delivery now". The schedule starts again: attempts go back to none, so the next result is attempt 1. The database allows at most six attempts, so a submission that failed for good could not be retried any other way; the log keeps every attempt.
  - Rows are locked with `skip locked` and leased for 5 minutes in a column of their own, `crm_claimed_until`, so two overlapping runs never send the same lead and `next_retry_at` stays the real schedule the leads page shows. If a run dies, the lease ends and the sweep picks the submission up again.
  - A submission on an inactive connection is left as it is and is sent once the connection is switched on (not sent, not lost). A submission whose connection was deleted can never be sent: the sweep marks it `not_applicable` with the reason "The connection was deleted." (the foreign key had already cleared its link).
  - It returns what the sender needs: the answers, the contact details, the form and project names, the project's address, the connection id and the number of this attempt.
- **`record_crm_delivery(...)` writes the log line and the new state together.** A success keeps the lead id and clears the retry time and the error. A failure keeps the reason (the answer's start, cut to 500 characters, or "The CRM did not accept the lead." when there was none) and the next retry time. The server chooses that time from the schedule (1, 5, 30, 120 and 720 minutes, BR-66, in `features/crm/retry.ts`); the database checks it is not in the past and not more than a day away, so a bug cannot leave a failed submission with no next try before the sixth attempt. After the sixth attempt the time is cleared. An HTTP status outside 100 to 599 is stored as none.
- **Indexes.** One for pending submissions by age (the sweep) and one for the pending or failed ones with no connection (the clean-up), both partial and small.
- **Types.** `src/types/database.types.ts` gains the column and both functions, written by hand in the generated format; CI's database check compares it.
- **Not in this change:** the sender loop, the retry route, the form hook, the admin's retry action and the cron arming (part B2).

## Consequences

- One migration and its pgTAP test (53 checks, run in CI): the due rules, the lease, the limit, inactive and deleted connections, a named submission, the recorded states and log lines, every refusal, and the privileges. The hosted dev database changes only through the db-deploy workflow, after the owner merges. No package, environment, CI or protected-file change.
- Rollback: drop both functions and the two indexes; `alter table public.form_submissions drop column crm_claimed_until` once nothing reads it. Submissions already sent keep their state.
