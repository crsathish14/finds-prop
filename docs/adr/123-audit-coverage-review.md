# ADR-123 · Audit coverage review, and the form's CRM link (S7-T12, part 1)

- Status: Accepted
- Date: 2026-11-11
- Related: ADR-028 (the audit log), ADR-113 (the CRM connections), ADR-097 (the same kind of database trigger and test), FR-SYS-06, NFR-07
- Plan for S7-T12 approved by the owner on 11 Nov 2026 ("approved"); the one addition below approved by the owner on 11 Nov 2026 ("Yes").

## The review

S7-T12 asks for a review of what the audit log records now that the admin and builder portals exist. Every sensitive operation was traced from its action (`src/features/*/action-config.ts`) and its tables to the entry it writes and the test that proves it. Entries hold ids, status names and the names of changed columns, never a phone number, an email address, a message, a secret or a header value; nobody can edit or delete one, and only the admin reads them (ADR-028).

| Operation                                                                                                     | Entry                                                                                  | Written by                                 | Tests                                                           |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------- |
| A listing's status or featured flag changes (submit, approve, reject, close, feature)                         | `listing.status_changed` (from, to, featured)                                          | trigger on `properties`                    | `audit_log`, `listing_*` pgTAP files, listing integration tests |
| A listing is deleted                                                                                          | `listing.deleted`                                                                      | trigger on `properties`                    | `audit_log`                                                     |
| A project's moderation, published or featured state changes                                                   | `project.moderation_changed`                                                           | trigger on `projects`                      | `audit_log`, project-moderation integration test                |
| A project is deleted                                                                                          | `project.deleted`                                                                      | trigger on `projects`                      | `audit_log`                                                     |
| A role is granted, revoked or changed (the customer role every account has is not recorded)                   | `role.granted`, `role.revoked`, `role.changed`                                         | trigger on `user_roles`                    | `audit_log`, `reserved_admins`                                  |
| A builder is created, activated, deactivated, or its email changes (recorded as "changed", never the address) | `builder.created`, `builder.activated`, `builder.deactivated`, `builder.email_changed` | trigger on `builders`                      | `audit_log`, builder-invite integration test                    |
| A CRM connection is created, updated or deleted                                                               | `crm.created`, `crm.updated`, `crm.deleted`                                            | trigger on `crm_integrations`              | `audit_log`, `crm_admin`, CRM integration tests                 |
| A CRM secret is set, changed or removed (which one, never the value)                                          | `crm.secret_changed`                                                                   | trigger on `crm_integration_secrets`       | `audit_log`, `crm_admin`                                        |
| **A form is linked to a CRM connection, pointed at another, or unlinked**                                     | **`form.crm_changed` (from, to)**                                                      | **trigger on `forms` (this change)**       | **`audit_form_crm`**                                            |
| A form is deleted                                                                                             | `form.deleted`                                                                         | trigger on `forms`                         | `audit_log`, form-builder integration test                      |
| A site setting changes (header, hero, homepage, footer, sponsors)                                             | `cms.changed` (the setting's key only)                                                 | triggers on `site_settings`                | `audit_log`, site-content and sponsors integration tests        |
| A project lead's status changes                                                                               | `lead.status_changed`                                                                  | the action (service-only `audit_record`)   | `lead-actions`                                                  |
| A unit is added, updated or deleted                                                                           | `unit.created`, `unit.updated`, `unit.deleted`                                         | the actions                                | `unit-actions`                                                  |
| A staff member signs in, or a sign-in is refused                                                              | `staff.signed_in`, `staff.sign_in_denied`                                              | the callback (service-only `audit_record`) | `staff-callback`, `audit`                                       |

Every destructive delete an admin or builder can make (a listing, a project, a form, a connection, a unit) is in the list.

## The one gap, and its fix

A form's `crm_integration_id` decides where a visitor's name, number and message are sent. The connections themselves were audited, but linking a form to one, pointing it at another or unlinking it was not, so the log could not answer "who sent this form's submissions to that CRM, and when". A trigger on `forms` now records `form.crm_changed` with the old and the new connection id (null for none) and the form's id as the entry's subject, for a form made already linked and for any change of the link. Deleting a connection unlinks its forms (the key is set to null), and each of them gets an entry, so the log also shows every form that stopped sending to a deleted connection. The actor is whoever made the change, as for the other entries. Nothing from the form or the connection is copied: no name, no address, no field.

## Left out on purpose

These were looked at and are not recorded. Each was already a decision in the code; it is written down here so the next review does not reopen it by accident.

- **An owner moves an enquiry to Contacted or Closed.** Enquiries are private messages; the action's note says the database writes no entry for them. A project lead's status is recorded because the admin and the builder both work on it.
- **A builder edits their own profile** (name, contact, phone, logo, website, introduction). The company's description of itself is not a decision; activation, type and email changes are recorded.
- **The admin creates, saves, switches or duplicates a form, or edits a project's content.** These are the admin's own content work, like the other content editors; the consequential parts are recorded (a form's CRM link, now; a project's moderation, publishing and featuring; a deletion). A builder's edit resets the project to Pending, which is recorded as a moderation change.
- **The admin tests a CRM connection or retries a delivery.** The CRM API logs keep every call with its outcome, a better record than an audit line.
- **A customer signs in, or holds the customer role.** Every account is a customer; only staff sign-ins and the other roles are recorded.
- **"CMS publish" in ADR-028.** A save in the content editors goes live at once (the live preview is before the save), so `cms.changed` is the publish record; there is no separate publish step to record.

## Consequences

- One migration (`20261111100000_audit_form_crm.sql`: a definer function with a pinned `search_path` and no execute for the public, visitors or signed-in users, and two triggers on `forms`) and its pgTAP test (`audit_form_crm.test.sql`, which runs in CI): a form made unlinked writes nothing; linking, pointing at another and unlinking each write one entry with the old and the new id; other changes and a save that keeps the link write nothing; a form made linked writes one; deleting a connection records each form it unlinked; an entry holds only the two ids, names the form and the admin, and carries no name or address; the function is not granted to the public; the triggers exist. The generated types do not list trigger functions, so `database.types.ts` does not change.
- No app code, package, environment, CI or protected-file change.
- Rollback: drop the two triggers and the function (`drop trigger forms_audit_crm_insert on public.forms; drop trigger forms_audit_crm_update on public.forms; drop function public.audit_form_crm();`). Entries already written stay, as the log is append-only.
- Retention of the log itself is the next part of S7-T12 (the log is kept, ADR-124).
