# ADR-108 · The form builder's parts (S7-T08, part B)

- Status: Accepted (the wording below awaits the owner's confirmation)
- Date: 2026-11-09
- Related: ADR-104 (the builder's server side), ADR-078 (the shared manager parts), ADR-020 (the Design Lab), ADR-054 (`DynamicForm` and the forms backend), FR-ADM-08, BR-60
- Plan for S7-T08 approved by the owner on 9 Nov 2026 ("approved"). The new pictures need the owner's approval (the Admin board).

## Decision

- **Four new domain parts and three Design Lab entries (the Admin board).** They hold no state and send nothing: the page keeps the values, the open row and the errors, and passes the words, already translated.
  - **`FormsManager`**: the Forms page's list. The heading and New form (a link), and the list as the shared `ResponsiveTable` (a table from 1024 px of room, cards below that): the name with its kind under it, the slug, how many fields, the placement, the CRM, an **Active switch** and Edit, Duplicate and Delete. Nothing yet is the shared empty page with New form.
  - **`FormSettingsFields`**: the editor's Settings box. Name, slug, kind, placement, project, CRM integration, button text, Active and success message, in two columns from 768 px. The **Project box is off, and says why ("Not needed for this placement"), unless the placement is "one project"**, when it is needed; the CRM box starts with "Not linked".
  - **`FormFieldsEditor`**: the editor's Fields box. Quick-add chips, a row for each field (label, kind, a Required badge) that opens to its label, key, kind, placeholder, **choices (one on each line) for a dropdown, radio group or checkbox group, a smallest and largest for text, textarea and number**, and Required, with Remove; Add field; and a notice at the limit (the chips and Add field go off). It is built on the shared `SortableList`: **dragging, and the arrow buttons beside the grip as the keyboard and touch way to reorder** (WCAG 2.5.7). The approved screen also draws Move up and Move down inside the open row; the shared row already has them, so they are not repeated there. A row with a problem is outlined and opens, with the message on its box.
  - **`FormPreview`**: the read-only picture beside the editor. It draws the fields and the button with the **same `DynamicForm` visitors get**, inside an inert, screen-reader-hidden wrapper, so what the admin sees is what a visitor gets and nothing in it can be used. While the form has no fields it says so.
- **A placeholder is drawn only for text, number, email, textarea and dropdown fields,** matching what the pages draw (and what the server keeps, ADR-104); the File type shows none.
- **Not in this change:** the pages, their words in `en.json`, and the connection to the actions (part C). The Design Lab uses plain English text.

## Wording to confirm

From the approved `admin-forms` screen (nothing to confirm): "Forms", "Forms shown on project pages and the contact page.", New form, the column names, Active, Edit, Duplicate, "Settings", the box names (Name, Slug, Kind, Placement, Project, CRM integration, Button text, Success message), "Not linked", "Not needed for this placement", "Fields", "Drag to reorder, or use the move buttons", "Quick add" with its chips, the field boxes (Label, Key, Type, Placeholder, Required), Move up, Move down, Remove, Add field, "Live preview (read only)". New, for your confirmation (the Design Lab shows them; the page uses the same words):

- **Choices** (the box for a dropdown, radio or checkbox group) with the hint **"One choice on each line."**; **Smallest** and **Largest** (the limits of a text, textarea or number).
- **"Choose a project"** (the Project box's first line when the placement is one project), and **"No forms yet"** with "Make a form to show on the contact page or a project page." (the empty page).
- **The limit notice:** "This form has the most fields it can hold" with "Remove a field to add another."; and **"No fields yet. Add one, or use a quick add."** for a form with none.
- **Names for screen readers:** "Edit field {name}", "Collapse field {name}", "Drag field {name}", "Move field {name} up/down", "Remove field {name}", and "New field" for a field with no label yet; "Active: {name}" for a form's switch and "Delete {name}".

## Consequences

- Four parts with a test file (27 tests: the list and its buttons, the settings boxes and the Project rule, the fields rows, open row, choices and limits, the arrows, errors, the limit and the empty note, the preview being inert) and three Design Lab entries with their states; new Admin board pictures, which need the owner's approval before their baselines are committed (as in S7-T02). No package, migration, environment, CI or protected-file change.
- Rollback: delete the four parts, the demos and the three entries.
