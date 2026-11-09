# ADR-085 · The connected admin Leads page (S7-T07, part C2)

- Status: Accepted
- Date: 2026-11-09
- Related: ADR-079 (the Leads table), ADR-083 (the submissions parts), ADR-082 (the server side), ADR-084 (the Units page, the same pattern), FR-ADM-06
- Plan approved by the owner on 8 Nov 2026 ("all approved"): "Retry delivery now" waits for the CRM task (S7-T09); the lead's state box works for the admin as well as the builder; there is no "Files" row.

## Decision

- **`/admin/leads` stops being a placeholder.** The server page reads the numbers of both tabs and the open tab's first page as the signed-in admin and hands them to `LeadsBoard`, which holds the heading and the two tabs, "Project leads" and "Form submissions", each with its number (counts of every lead and every submission, whatever the filters; `getLeadCounts`, two count-only reads). Only the open tab's list is read. The role gate in the portal layout has already sent anyone else away.
- **The tab and the submissions filters are in the address** (R-FE-11): `?tab=submissions` and `?range=`, `?form=`, `?project=`, `?source=`, `?crm=`. A value that is not valid is dropped; the default (the project leads tab, the last 30 days, no form, project or source, any CRM state) is left out. A filter choice goes to the address for it, so the page is read again and the count is right; Reset goes to the bare submissions address.
- **Project leads:** `LeadsTable` with the state box. A state is saved as soon as it is chosen: the box shows the new state at once, is off while saving, and goes back to the old state if the save fails, with the failure said in words (a lead that is gone, as one sentence, and the page is read again). "Show more" adds the next 25 leads in place; a page read again starts the list over from its first leads with the states the server holds. There are no filters on this tab (the approved screen has none); the server side can filter by project and state when they are wanted.
- **Form submissions:** the filters of ADR-083, the table with a Details button on each row, and the details in a drawer. The answers show the form's own questions (a list as its items with commas, yes and no as words). A failed delivery shows "CRM delivery failed" with the HTTP code (or, when there was none, the attempt it failed on) and when it will be tried again ("in 30 minutes", worked out from the moment the page was read, which the page carries as `readAt`, so no component reads the clock) or that no more retries are planned. There is no "Retry delivery now" (S7-T09).
- **Mobile numbers** are shown in groups ("98410 55512", or "+91 98410 55512" when the stored number carries the country code) and called with a link; a number in any other shape is shown as stored.
- **No Design Lab change and no pictures:** every part of the page is already in the Lab. Behaviour is checked by tests with stand-in actions; the counts read has an integration test.

## Wording to confirm

The words go into `en.json` under `admin.leads`. From the approved admin-leads and builder-leads screens: "Leads", "Project leads and form submissions across the platform.", the tabs "Project leads" and "Form submissions", the column headings, the states "New", "Contacted" and "Closed", "Status for {name}", "Form submissions" and its headings, "Submission details", the filters of ADR-083 and the failure "CRM delivery failed" with "HTTP 502 on attempt 2. The next automatic retry is in 30 minutes." New, for your confirmation:

- The lead types as "Enquiry", "Site visit" and "Brochure" (ADR-079).
- "{shown} of {total} leads" and "{shown} of {total} submissions" under the lists.
- The empty pages: "No leads yet" with "Leads from your projects will appear here.", "No form submissions yet" with "Submissions from the site's forms will appear here.", and, when filters are on, "No submissions match" with "Try other dates, or reset the filters."
- "Show more leads", "Show more submissions" and "More could not be loaded. Please try again."
- "This lead has changed since the page was loaded. The page has been refreshed."
- In the details: "Yes" and "No" for a yes-or-no answer, "The delivery failed on attempt {attempts}." (a failure with no HTTP code), "No more automatic retries are planned.", and the times "a moment", "{n} minutes", "{n} hours" and "{n} days".
- The accessible name of the tabs, "Lead sources".

## Consequences

- No migration, package, gate or environment change. A page, a client board with two panels, the address and formatting helpers, a count read with its integration test, a `readAt` on a submissions page, and the words.
- Rollback: restore the placeholder page and delete the board, panels, helpers, words and tests. Leads and submissions stay as they are.
