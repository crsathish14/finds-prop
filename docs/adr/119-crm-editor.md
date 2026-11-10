# ADR-119 · The admin's CRM connection editor (S7-T09, part D2)

- Status: Accepted (the wording below waits for the owner's confirmation)
- Date: 2026-11-10
- Related: ADR-113 (the save action and its rules), ADR-117 (the editor's parts), ADR-118 (the CRM page that links here), FR-ADM-09, BR-64, BR-65
- Plan for S7-T09 parts C and D approved by the owner on 10 Nov 2026; the D2 plan approved the same day.

## Decision

- **Two pages, one editor.** `/admin/crm/new` (empty boxes) and `/admin/crm/[id]` (filled with what is stored) draw `CrmEditor`, a client file in the CRM feature. The server pages read the connection (`getCrmIntegrations`, which returns only whether each secret is set) and the project list for the project codes (`getProjectOptions` from the units feature, as the Forms editor does) and pass them in with the save action, so the client file imports nothing from a feature's index or from server code (a test reads the file to keep it so). An address that is not an id, or a connection that does not exist, is "not found".
- **A saved secret is never in the page.** The draft holds only what the admin has typed and what they chose for each secret: keep, replace or clear. Saving sends nothing for a kept secret (the server keeps what it holds), the text for a replaced one, `null` for a cleared one. A replaced secret left empty sends nothing, which keeps it. A secret with nothing saved is a box that sends its text if any is typed. Cancel and Undo drop what was typed. After a save of a connection that exists, every secret goes back to "kept" with nothing typed, and the page is read again, so a secret is held in the browser only between typing it and pressing Save.
- **Rows that are empty are left out; rows half filled are sent** so the server says which box is missing. The row a problem lands on is found from its place in the request (the server counts the rows it received), so an empty row left out before it does not move the message to the wrong row.
- **A name used twice is caught before sending,** in a header name, a body field and a project, ignoring case and spaces at the ends, with the same words and the same place (the later row's first box) as the server's own check (`validation.localityLabelTaken`). A problem goes away from a box when the box is changed.
- **The project list offers every project in every row, and repeats are flagged,** instead of offering each project once. The shared rows part takes one list for all rows; leaving out the projects chosen in other rows would take the chosen one out of its own row's list. A project used twice is flagged as a name used twice is.
- **What the server says is wrong goes on its box:** the base URL error (`validation.crmUrlNotAllowed`, "Must be https and a public address."), a box of the Connection, a secret, or a row's box. A summary above the form counts the problems and the page scrolls to it, as the Forms editor does. What was typed, secrets included, is kept when a save fails. A failure with no box to blame (for example a limit) is said in words and the page is read again.
- **After a save:** a new connection opens on its own page; a connection that exists is read again. A "Connection saved" message is shown either way.
- **No "leave without saving" question,** as the Forms editor has none.
- **The page frame** is the breadcrumb ("CRM integrations", then the connection's name) and the heading, with the three `FormSection` boxes the approved screen draws (Connection, Credentials, Headers and body) in one column up to 768 px wide, and the shared save bar.

## Wording to confirm (owner)

The approved admin-crm screen gives the box names, the Credentials line, the hint under the base URL, the base URL error, the save bar note and button, and the list headings and add buttons. These lines are not in it:

- The heading of a new connection: "New connection" (the same words as the button that leads here).
- The breadcrumb's words for a screen reader: "Breadcrumb" and "Back to CRM integrations".
- The summary above the form: "{count} thing(s) need(s) attention" with "Check the boxes marked below, then save again." (the same words as the Forms editor's).
- The message after a save: "Connection saved".
- The remove buttons' names, such as "Remove header X-Source", "Remove mapping full_name" and "Remove code for Kadal Vista" (the screen says "Remove").
- "Saving…" on the save button while it works.
- The tab titles of the pages: "New connection" and "Edit connection".

(The words "Cancel", "Undo", "Will be removed when you save.", the empty lines, "Add code" and "Choose a project" were listed in ADR-117.)

## Consequences

- Two pages, one editor and its pure draft rules, and the editor's words in `en.json` (`admin.crm.editor.*`). Unit tests for the draft rules (the secret modes in the request, empty rows, repeated names, a server problem found from its place in the request) and the editor (a new connection, one that exists, each secret mode, the three lists, the server's problems on their boxes, a failure with no box, saving). The save itself is covered by `IT-crm` (ADR-113).
- No migration, package, environment, CI, protected-file or Design Lab change: the parts and their pictures are unchanged, so no new pictures. With this, S7-T09 is complete: parts A to D.
- Rollback: restore the placeholders for the two pages and remove the editor; the CRM page's New connection and Edit links would lead to them.
