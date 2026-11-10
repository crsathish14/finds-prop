# ADR-117 · The CRM page's parts, and the Leads page's Agent column and Retry button (S7-T09, part C)

- Status: Accepted (the wording below waits for the owner's confirmation)
- Date: 2026-11-10
- Related: ADR-083 (the submissions parts, which left the Agent column and Retry for this task), ADR-108 (the form builder parts, the same shape), ADR-113 to ADR-116 (the server side), FR-ADM-09, FR-ADM-06, BR-64, BR-65
- Plan for S7-T09 parts C and D approved by the owner on 10 Nov 2026 ("approved"): C is the Lab parts and their pictures, D1 the CRM page, D2 the editor pages.

## Decision

- **Five parts, one new board.** `CrmPageHeader` and `CrmConnectionCards` (the heading, New connection and a card for each connection), `CrmLogsTable` (the API logs), `CrmConnectionFields` and `CrmCredentialField` (the Connection box and each secret), and `CrmRowsEditor` (a list of pairs, used three times for headers, body mapping and project codes). None holds state: the page passes the words already translated and what each button does, as every admin part does. They sit on a Design Lab board of their own, `/design-system/crm`, because the Admin board is already too tall to photograph in time at 820 and 1440 px.
- **The tabs are the page's, not a part.** The page uses the shared `Tabs` with the tab in the address (`?tab=logs`), as the Leads page does; the parts draw what is inside a tab. The test result is an `Alert` passed in as `notice`, and the delete question is the shared `ConfirmDialog`, both owned by the page.
- **A secret is never in the browser's data.** `CrmCredentialField` shows a saved secret as 16 dots in a read-only box, whatever the secret is. Replace turns it into a password box that does not autofill; Clear turns it into a line saying what saving will do, with Undo. A secret with nothing saved is a password box with a "Not set" placeholder. The three modes (keep, replace, clear) map to the part A save rules (left out, text, null).
- **Delete is on every card.** The approved screen draws no delete button on the inactive "Backup CRM" card, yet its delete question is about that very connection. The part takes the delete button as optional; the page will give it to every card.
- **Test API is off for an inactive connection,** as the screen draws it. (The server can test one; the screen does not offer it.)
- **Two optional additions to the Leads parts,** so the existing Admin board and its pictures are unchanged: `SubmissionsTable` draws an Agent column (the CRM connection that took the submission, between Form and CRM) only when it is given a heading for it, and `SubmissionDetail` draws "Retry delivery now" under a failed delivery only when it is given the button. Part D1 turns them on. Their new states are photographed on the CRM board.
- **Retry on a log line** is for the page to give only to the latest line of a submission that is still failed, never to a test line (it has no submission).
- **Not in this change:** the pages, the actions' wiring, the log read and the connection list (parts D1 and D2).

## Wording to confirm (owner)

The approved admin-crm and admin-leads screens give most of the text (headings, tabs, buttons, the test results, the secrets line, the delete question, the retry schedule sentence, "Retry delivery now"). These lines are not in them:

- Empty states: "No connections yet" with "Add a CRM connection to send form submissions to it." and the button "New connection"; "No deliveries yet" with "Calls to your CRMs show here, newest first."
- The credential boxes after Replace and Clear: "Cancel" (go back to the saved secret), "Undo", and "Will be removed when you save."
- The lists in the editor: the empty lines "No headers.", "No mapping." and "No codes."; the button "Add code" (the screen shows Add header and Add mapping only); "Choose a project" as the first choice of the project list; and the remove buttons' names, such as "Remove header X-Source" (the screen says "Remove").
- The label "Status" over the Active switch (the screen has the switch alone; the Forms editor uses the same label).
- The form name "Connection test" in the log for a test call (shown by part D1, written by the server in part A).

## Consequences

- Five parts with 37 unit tests (the cards, the logs, the fields, the credential modes, the rows, the Agent column, the Retry button), five Design Lab entries with their states, and new Design Lab pictures for the CRM board at 390, 820 and 1440 px. The pictures come from CI, are shown to the owner, and the baselines are committed only after the owner approves them. No server, database, package, environment, CI or protected-file change (the Design Lab's index and e2e lists gain the new board, as for each earlier board).
- Rollback: remove the board, its page, the five parts and the two optional props; nothing else uses them yet.
