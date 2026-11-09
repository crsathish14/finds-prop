# ADR-104 · The admin's form builder: the server side (S7-T08, part A)

- Status: Accepted (the wording below awaits the owner's confirmation)
- Date: 2026-11-09
- Related: ADR-054 (the forms backend), ADR-081 (the same pattern for units), FR-ADM-08, BR-60 to BR-63, FR-SYS-04
- Plan for S7-T08 approved by the owner on 9 Nov 2026 ("approved"), with the defaults offered: File is kept in the list of field types as the approved screen draws it, and Duplicate makes a switched-off copy.

## Decision

- **A new `form-builder` feature, with no migration.** The `forms` table already has everything the builder needs: the policies let only the super admin insert, update, delete and read every form; the column grants include the CRM link, which is hidden from everyone else; `admin_forms()` lists the forms with that link; and the table keeps the field list to 30 and a project only for "one project". So the actions run as the signed-in admin through their own session (not the service role), and the database refuses everyone else.
- **Five actions, `admin_edit` limit.** `createForm`, `updateForm`, `setFormActive`, `duplicateForm` and `deleteForm`, for a super admin, limited with the admin's other edits (`admin_edit`, 600 an hour: no new scope and no change to `docs/engineering/security.md`). No idempotency key: saving sets values; a second create with the same slug is refused by the database; a second duplicate makes the next numbered copy; a second delete finds nothing. Every change refreshes the forms' cache tag, since a form is drawn on the contact page and on project pages. The database audits a deleted form (`form.deleted`); creating, saving and switching a form are the admin's content work and have no audit entry.
- **What is checked before it is saved (BR-60).** The field list has the shape the pages already read and check submissions against (`formFieldSchema`): the label, the key (lower case letters, digits and underscores, starting with a letter), one of the nine types, an optional placeholder, choices, a smallest and largest value or length, and Required. On top of that:
  - **Keys are unique** in a form; the second field with a key gets the error, on its own key box (`fields.N.key`).
  - **A dropdown and a radio group need at least one choice**, and choices must differ (ignoring case). A group of checkboxes may have none (it is then a single box).
  - **A smallest value above the largest is refused** (for text, textarea and number).
  - **What a kind of field does not use is not kept**: a dropdown keeps its choices, a number or text keeps its limits, a placeholder only where one is drawn. So the stored list holds only what the pages use.
  - **A form needs at least one field**, and no more than 30.
  - **A project is needed for "one project", and only then**: for any other placement a project that was sent is let go.
  - A slug already used by another form is an error on the slug box; the name (2 to 120), the button text (40) and the success message (300) are limited.
- **Duplicate.** The copy has the name "{name} (copy)" and the slug "{slug}-copy" (then "-copy-2" and so on if that is taken, up to six tries), is **switched off** so it cannot go live by accident, and has the same kind, placement, project, CRM link, button text, success message and fields.
- **Reads.** `getFormBuilderData()` gives every form (newest change first) with the name of its project and its CRM integration, and the projects and integrations the editor's pickers offer. The CRM integrations are read by name only (the secrets are in a table of their own, and there are no integrations until the CRM page, S7-T09). A stored field that does not fit the shape (a hand-made change) is left out of the editor and counted.
- **File fields.** File stays in the list of types as the approved screen draws it; visitors see nothing for it yet and the server takes no answer for one (ADR-054) until the uploads change.
- **Not in this change:** the parts (the forms table and the field editor, with their Design Lab entries) and the pages.

## Wording to confirm

New messages under `validation.*` (the screens look them up): "This slug is already used by another form.", "Use lower case letters, numbers and underscores, starting with a letter.", "This key is already used by another field." (the approved screen words it `Key "name" is already used by another field.`; the page can use that exact line, since it knows the key), "Add at least one choice.", "Each choice must be different.", "Add at least one field.", "Choose the project this form is for." and "The largest value must be the same as or more than the smallest."

## Consequences

- A feature with its unit tests (the schema rules, the error mapping, what each action writes, the copy, who may call each action, the stores and the reads) and an integration test (run in CI) against a real database: create, duplicate slug, save with a project, switch, copy, delete with the submissions kept and the deletion audited, the list with the CRM link, and a customer refused. No migration, package, environment, CI or protected-file change.
- Rollback: delete the feature and the eight messages. Forms already saved are ordinary rows.
