# ADR-109 · The form builder's pages (S7-T08, part C)

- Status: Accepted (the wording below awaits the owner's confirmation)
- Date: 2026-11-09
- Related: ADR-104 (the builder's server side), ADR-108 (the parts), ADR-078 (the shared manager parts), FR-ADM-08, BR-60
- Plan for S7-T08 approved by the owner on 9 Nov 2026 ("approved").

## Decision

- **Three pages connect the parts to the actions of ADR-104.** `/admin/forms` (the list), `/admin/forms/new` and `/admin/forms/[id]` (the editor). Each reads as the signed-in admin with `getFormBuilderData()` and is never cached; the portal's role gate has already sent anyone else away. An address that is not a form id, or a form that does not exist, is "not found".
- **The list (`AdminForms`)** shows each form in `FormsManager`. The **Active switch** moves at once and goes back if the save fails; **Duplicate** makes the copy (switched off, ADR-104) and the toast names its slug; **Delete** asks first, with the approved question and sentence. After each change the page is read again. One change runs at a time.
- **The editor (`FormEditor`)** keeps the boxes, the open field, the problems and whether it is saving, and puts the Settings, the Fields editor and the live preview (beside it from 1024 px, sticking while the fields scroll) in the approved layout, with the save bar under them. It sends the values to `createForm` or `updateForm` and puts each problem the server names on its box by path (`slug`, `fields.2.options`); a problem with no box (no fields at all) is listed in the alert on top. A box's problem goes when the admin changes that box. **A key used twice is caught before sending** and says which key: `Key "name" is already used by another field.`
- **Making and saving.** Saving a form that exists keeps the admin on the page (toast "Form saved", page read again). Making a new one opens it on its own page, so a second Save cannot make it twice. Cancel goes back to the list.
- **Helpers that save typing, for new things only.** A new form's **slug follows its name**, and a new field's **key follows its label**, until the admin types their own. **A saved field's key never changes by itself** (the approved default). A quick add that repeats a key gets the next free one (`mobile_2`).
- **What is sent is what the schema can accept.** The choices go as a list (blank lines dropped) and only for a dropdown, radio group or checkbox group; the smallest and largest only for text, textarea and number; the project only when the placement is "one project". Boxes a kind of field does not use are never sent, so they cannot be a problem. Stored fields that do not fit the shape (a hand-made change, ADR-104) are counted in a notice, and saving removes them.
- **Quick adds:** Name and Mobile are required text; Email is an email box; City is text; Budget is a number; **BHK is a dropdown with the choices "1 BHK", "2 BHK", "3 BHK" and "4 BHK"** (the choices are mine, easy to change in the editor).
- **The list says "None", not "None (fallback)"** for a form shown nowhere: the screen draws the second words for the standard enquiry form only, and the page does not know which form that is. A form for one project says "{project} only".
- **Not in this change:** nothing more for S7-T08. Its pictures are part B's.

## Wording to confirm

From the approved `admin-forms` screen (nothing to confirm): "Forms", "Forms shown on project pages and the contact page.", New form, the column names, Edit, Duplicate, the Delete question and sentence, "Edit form", the crumb, "Settings", "Quick add", "Live preview (read only)", "Submissions are checked against these fields on the server.", Cancel, Save form, "Form saved", and `Key "name" is already used by another field.`. New, for your confirmation (all under `admin.forms` in `en.json`):

- **Page words:** "New form" as the editor's heading and tab title; "Back to Forms" (the crumb on a phone); "Saving" on the Save button while it works; "{count} forms" under the list (one form: "1 form"); "{project} only" for a form shown on one project.
- **Toasts:** "{name} is now active" and "{name} is now off" (the switch); "Copy made" with "The copy is called {slug} and is switched off."; "{name} deleted"; and, when the form changed or was removed since the page was loaded, "This form has changed or been removed since the page was loaded. The page has been refreshed."
- **The problems alert:** "{count} thing needs attention" / "{count} things need attention" with "Check the boxes marked below, then save again." (the same words as the Site content pages).
- **The notice for stored fields that do not fit:** "{count} stored field does not fit the builder and is not shown. Saving removes it." (plural: "fields do not fit … Saving removes them.").
- **The quick-add choices for BHK:** 1 BHK, 2 BHK, 3 BHK, 4 BHK.

## Consequences

- Three pages, two connected screens, the helper functions, 42 new tests (17 for the helpers, 8 for the list, 17 for the editor), and about 120 new words in `en.json`. No package, migration, environment, CI, protected-file or picture change.
- The "Forms" link in the admin menu already pointed at `/admin/forms`; it now opens a real page instead of the placeholder.
- Rollback: delete the three pages, the two connected screens and the helpers, and the `admin.forms` words.
