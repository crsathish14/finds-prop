# ADR-082 · Admin leads and form submissions: the server side (S7-T07, part A2)

- Status: Accepted
- Date: 2026-11-08
- Related: ADR-081 (the units half and the `admin_edit` scope), ADR-079 (the Leads table part), ADR-065 (the queue's cursor), FR-ADM-06, FR-BLD-04, BR-46, BR-47, DEC-27
- Plan approved by the owner on 8 Nov 2026 ("all approved"): "Retry delivery now" waits for the CRM task (S7-T09); the lead's state box works for the admin as well as the builder; form submissions have no uploads (skipped in Stage 5); lead and state changes are audited in the action.

## Decision

- **A new `leads` feature, no migration.** The database already lets an admin read every lead and every form submission, and its column grant lets a lead's state (and nothing else) be changed by the admin or by the builder of the lead's project (`project_leads` policies and `guard_project_leads`). The rules in code are the validation and the mapping of the database's refusals.
- **The user's own client, not the service role,** as for units: the policies decide, and the service-role allow-list is unchanged. The same store, with a builder's session, will serve the builder portal (S7-T03); the integration test shows a builder changes the state of their own project's lead, reads only their own leads, and reads no form submissions.
- **Three actions**, all for a super admin: `setLeadStatus`, and the two "Show more" reads `loadMoreLeads` and `loadMoreSubmissions`. A state change is limited by `admin_edit` (600 per admin per hour, ADR-081) and adds an audit entry (`lead.status_changed`, entity `lead` and its id, with no details of the lead), because the database does not audit leads. It refreshes no cache tag: leads are never shown to the public.
- **Project leads** are read newest first, 25 to a page, filtered by project and state, with the count of leads the filters match. **Form submissions** are read the same way, filtered by date range (7, 30 or 90 days, or all; 30 by default), form, project, source and CRM state, and each carries how its CRM delivery stands (state, HTTP code, attempts, next retry, last error, the CRM's lead id).
- **The page cursor is the creation time and id of the last row,** encoded as in the listing queue (ADR-065), and a page reads "older than that, or the same moment with a smaller id" so no row is read twice or missed when several arrive in the same moment. A cursor the list did not make is refused by the "Show more" actions and ignored by a page address.
- **An answer shows the form's own question.** The submission's answers are stored by key; the page reads the questions of the forms on the page (`forms.fields`) and labels each answer, in the form's order, with the name, mobile and email left to their own fields. An answer the form no longer asks shows its key, last.
- **The sources to filter by** are those of the 500 most recent submissions (there is no list of sources to read), once each and in alphabetical order. The projects and forms come from `admin_projects()` and `forms`.
- **Not in this change:** "Retry delivery now" and the delivery engine (S7-T09, where the roadmap puts the retry route); the pages and the submissions Lab parts (the next changes); files on submissions (none are accepted).
- **The Units reads now take a client,** like these (`readUnitsPage`, `readProjectOptions`, with `getUnitsPage`, `getProjectOptions` making it from the cookies), so the integration tests can pass the admin's. The integration tests cover the page size, the cursor, the count, the filters, the search (a `%` is a letter) and the project picker of both lists.

## Wording to confirm

No new message: a state or cursor that is not valid uses the existing `validation.invalid`.

## Consequences

- No migration, package, gate, environment or protected-document change, and no new rate-limit scope (it uses `admin_edit` from ADR-081).
- The integration tests (`tests/integration/leads.test.ts`, and the paging tests added to `units.test.ts`) run in CI against the real local database; they were not run on the developer's machine, because the owner asked that nothing be started locally.
- Rollback: delete the `leads` feature and its tests, and the paging tests of `units.test.ts`. Leads and submissions already written stay as they are.
