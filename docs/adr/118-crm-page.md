# ADR-118 · The admin's CRM page, the API logs read, and the Leads page's Agent column and Retry (S7-T09, part D1)

- Status: Accepted (the wording below waits for the owner's confirmation)
- Date: 2026-11-10
- Related: ADR-113 (the connections and their actions), ADR-116 (the delivery engine and "Retry delivery now"), ADR-117 (the parts this page uses), FR-ADM-09, FR-ADM-06, BR-64, BR-65, BR-66
- Plan for S7-T09 parts C and D approved by the owner on 10 Nov 2026 ("approved"); the D1 plan approved the same day.

## Decision

- **`/admin/crm` replaces the placeholder.** One client page, `AdminCrm`, with the shared `Tabs`: "Connections" and "API logs", the tab in the address (`?tab=logs`; any other value is the first tab). It draws the part C parts and calls the four actions it is given by the server page (Test API, Delete, Retry), so the client file imports nothing from a feature's index or from the server (a test reads the file to keep it so).
- **The logs are a plain read as the admin, with no migration.** The newest 100 lines of `crm_api_logs` (`CRM_LOGS_LIMIT`), read through the admin's own session: the table's policy already lets an admin read and shows anyone else nothing. The columns are explicit and the answer text is the already-cut, secret-blanked snippet the server wrote (BR-64).
- **Retry is offered once per submission, on the newest line, while it is still failed.** The page reads which of the submissions the lines name are failed now (one more read, by id), and `toCrmLogViews` marks a line retryable only when it is the first line seen for its submission (the lines are newest first), it failed, and the submission is still failed. A test line has no submission and never gets Retry. An older line, a line that worked, and a submission that has since gone through get none. If the press finds the submission already sent, being sent, or on an inactive connection, the action answers a conflict and the page says so and reads again.
- **"N failed" on the tab counts submissions that are failed now,** not failed log lines: a submission that failed twice and then went through counts for nothing; one that failed three times counts once. It is read as a count of `form_submissions` with a failed CRM state. With none, the tab shows no number.
- **Both tabs' data is read on either tab.** The connections (one function call) and the logs (two small reads and a count) are cheap and the tab numbers need both. Nothing is cached.
- **Test API shows its result above the cards** as the approved screen draws it: an Alert with the CRM's name, the HTTP status and the time. A test with no answer (not allowed, unreachable, too slow) has its own line. The result stays until the next test, a delete, or leaving the page.
- **Delete is on every card and asks first** (ADR-117), with the screen's own question. A delete that finds the connection already gone says so and reads the page again.
- **Every card shows all three secrets as Set or Not set,** including an inactive one. The approved screen draws the inactive "Backup CRM" card with none, but that is the one card where saying "nothing is set" helps most.
- **The address on a card is the base and the endpoint joined with one slash,** the same address the delivery engine calls. `joinUrl` moved from the sending file into its own small file (`address.ts`) so the browser code can use it without pulling in the sending code (its address lookup is server-only); `send.ts` still exports it.
- **The Leads page gets the two additions ADR-117 prepared.** The submissions list reads the connection's name through the submission's own CRM link (a join on an existing column) and draws it in the Agent column, with a dash when there is none (no link, or the connection was deleted). "Retry delivery now" appears under a failed delivery in the submission's details. The server page gives the Leads board the CRM feature's retry action, so the Leads code does not import from the CRM feature. After a retry the page is read again, so the details show what the server holds.
- **The New connection button is on the Connections tab only,** as ADR-117 left it. It and Edit link to `/admin/crm/new` and `/admin/crm/[id]`, which are part D2 (until then they lead to the placeholder).
- **Not in this change:** the editor pages (part D2).

## Wording to confirm (owner)

The approved admin-crm and admin-leads screens give the headings, tabs, the test results with a status, the secrets line, the delete question, the retry schedule sentence and "Retry delivery now". These lines are not in them:

- A test that got no answer: "{name} did not answer. Check the address, then test again."
- The line when the log is full: "The newest 100 deliveries" (otherwise "3 deliveries", as the screen has it).
- The messages after a change: "{name} deleted"; after "Retry delivery now" or a log line's Retry: "Delivery sent" with "The CRM accepted the lead.", or "The delivery failed again" with "The CRM answered HTTP 502. The next try is scheduled." or "The CRM did not answer. The next try is scheduled."
- When the thing changed under the admin: "This connection has changed or been removed since the page was loaded. The page has been refreshed." and "This submission can't be sent now. It may already be sent, or its connection may be off. The page has been refreshed." (the same shape as the Forms page's).
- The time in the logs and the Leads list reads like the rest of the admin ("28 Oct 2026, 11:02 am"); the screen has "28 Oct, 11:02".
- The start of an answer is cut at 140 characters with an ellipsis (the log keeps up to 500).
- The names for a screen reader: the delete button "Delete {name}".
- The word "CRM sections" naming the two tabs for a screen reader.

## Consequences

- One page, one logs read, one view file, two small changes to the Leads page (a joined name and a button) and the page's words in `en.json` (`admin.crm.*`, `admin.leads.submissions.table.agent`, `admin.leads.detail.retry`). Unit tests for the view rules, the page (both tabs, Test API in each state, Delete asking first, Retry only where offered, every failure) and the Leads additions; an integration test (CI) for the logs read against a real database: Retry flags on the newest failed line only, never on a test or a submission that went through, the Agent name and its absence after a delete, and nothing for a builder.
- No migration, package, environment, CI, protected-file or Design Lab change: the parts and their pictures are unchanged, so no new pictures.
- Rollback: restore the placeholder page and remove the Agent join and the retry wiring; nothing else uses them.
