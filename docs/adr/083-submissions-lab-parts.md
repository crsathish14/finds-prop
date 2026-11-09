# ADR-083 · The form submissions parts (S7-T07, part B)

- Status: Accepted
- Date: 2026-11-08
- Related: ADR-078, ADR-079 (the other shared list parts), ADR-082 (the server side), ADR-020 (Design Lab), FR-ADM-06
- Plan approved by the owner on 8 Nov 2026 ("all approved"): the Form submissions tab and its details drawer belong to T07, the Retry delivery button waits for the CRM task (S7-T09), and uploads were skipped in Stage 5 (no "Files" row).

## Decision

- **Three new domain parts, three Admin board entries.** `SubmissionsTable` (when, name, mobile, project, source, form, CRM state and a Details button), `SubmissionsFilters` (date range, form, project, source, CRM state and Reset) and `SubmissionDetail` (everything one submission holds, for a drawer). They hold no state, take their words as props, draw the list with `ResponsiveTable` (ADR-078) and open in the `ManagerDrawer`.
- **A new status kind `crm`** (Delivered green, Failed red, Retrying amber, Not sent grey) in the status map, with its four words in `status.crm.*`, so a delivery keeps one colour everywhere (R-DS-09). The approved screen's words "Delivered", "Failed" and "Retrying" are used; "Not sent" is new.
- **Details is a button on each row,** with the person's name as hidden text, so every row has a named control a keyboard and a screen reader can reach. The approved screen says "Select a row to see the full submission"; the note under the list is a prop, so the page says "Select Details to see the full submission." (new wording below).
- **No "Agent" column.** The approved screen has one (which CRM connection took the submission, "Sales team"). The server side does not read the connection's name yet, and the CRM task (S7-T09) owns the connections; the column comes with it.
- **No "Retry delivery now" button.** `SubmissionDetail` shows the failure and its reason; the button comes with the delivery engine (S7-T09).
- **The filter boxes are native lists** (the phone's own picker opens). The date box has no "all" choice of its own ("All time" is one of its options); the form, project and source boxes have an "All …" first choice, which is the empty value; CRM status has "Any".
- **Not in this change:** the data, the actions and the page (the next change connects them).

## Wording to confirm

Plain English in the Design Lab; the connected page puts the same words in `en.json`. From the approved admin-leads screen: "Form submissions", the column headings "Created", "Name", "Mobile", "Project", "Source", "Form" and "CRM", "{n} submissions", the boxes "Date range", "Form", "Project", "Source", "CRM status", "All forms", "All projects", "All sources", "Any", "Failed", "Reset", "Submission details", the fields "Created", "Name", "Mobile", "Form", "Project", "Source", "Message", the states "Delivered", "Failed" and "Retrying", and the failure "CRM delivery failed" with "HTTP 502 on attempt 2. The next automatic retry is in 30 minutes." New, for your confirmation:

- The state "Not sent", for a submission whose form has no CRM connection.
- The date choices "Last 7 days", "Last 90 days" and "All time" (the screen shows "Last 30 days" and a list with more).
- "Details" on each row, and the note "Select Details to see the full submission." in place of "Select a row to see the full submission."
- The headings "Answers" and "CRM" inside the details, "Email" as a field there, and "CRM id" before the CRM's own id.
- The CRM box offers "Any", "Failed", "Retrying", "Delivered" and "Not sent".

## Consequences

- No migration, package, gate, environment or protected-document change. Three parts, a status kind with four words and three Design Lab entries on the Admin board; its three pictures change again and are added from CI after the owner approves them.
- The drawer opens from a button in the Design Lab and is not part of the pictures (an overlay).
- Rollback: delete the three parts, their entries, their tests and the `crm` status kind. Nothing is destroyed.
