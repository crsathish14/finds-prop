# ADR-054 · The forms backend (S5-T05, first change)

- Status: Accepted (backend); the renderer and the contact page, the uploads and the project's assigned form are the next changes
- Date: 2026-11-06
- Related: ADR-046 (project leads), ADR-051 (the enquiry backend), ADR-018 (rate limiting), `docs/engineering/security.md` 4.3, FR-PUB-11, FR-SYS-04, BR-49, BR-60 to BR-63, BR-70, BR-75
- Plan approved by the owner on 6 Nov 2026, "All recommended": four changes (this backend, the renderer with the contact page and a built-in default form, the uploads, the project's assigned form), rate limit only on the open contact form, uploads built in their own change, and the sign-in gate kept on a project's assigned form. Call, WhatsApp, brochure and shortlist events stay out of phase one.

## Decision

- **`record_form_submission`** stores one submission and returns its id. It is the only way in and execute is granted to `service_role` alone (submissions have no client write). The form is named by its slug and must be active and shown somewhere (a placement other than "none"); anything else is `P0002`, not found. The form's CRM link is copied and the delivery is marked pending (the delivery itself is Stage 7). A repeat with the same idempotency key returns the first submission.
- **Which project:** a form made for one project uses that project (if a visitor can see it: approved, published, builder active, BR-94); a form shown on every project page uses the project page it was filled in on, named by slug. A project a visitor cannot see is ignored, not an error.
- **Mirroring into project leads (BR-63):** for an enquiry, brochure or site-visit form with a project, a name of 2 to 80 characters and a phone of 6 to 15 digits, the submission is also written to `project_leads`. A site visit also needs a valid `visit_date` in the answers. A mirror that cannot be made never stops the submission from being stored.
- **The answers are checked on the server against the stored fields (BR-60)** (`validateSubmission`, pure): every one of the nine types, field by field, with the keys the screens turn into words. `name`, `mobile` and `email` fill the submission's own columns (the mobile as 6 to 15 digits, the email in lower case); everything else is data. An answer for a key the form does not have is dropped, so a request cannot add data the form never asked for. All wrong fields are reported at once and nothing is stored. The stored fields are read from the database by the slug, never taken from the request.
- **The action `submitForm`** is open to anyone (the contact form is for visitors). It counts the existing `form_submit` limit, 5 per visitor per form per hour (BR-61, BR-70), keyed by the form's slug so each form is limited on its own, and carries a one-time key (R-BE-05). The visitor is a one-way hash (BR-75).
- **Files are not accepted yet.** A file field takes no answer in this change (an optional one is left out, a required one is refused), so no path from a request can reach a submission. The upload step, with signed addresses and a check of each file's real size and type, is its own change.
- **Service-role allow-list:** `src/features/forms/service.ts` was already on the allow-list and in `security.md` 4.3 (S3), so this change needs no gate change.
- **Hand-written types:** the function's entry in `src/types/database.types.ts` was written by hand in the generator's format (alphabetical among the functions); CI's `gen-types --check` confirms it.

## Consequences

- Nothing is visible yet. There is no form to send (the admin form builder is Stage 7) and no page uses the action until the next change.
- Not tried against a real database here (no Docker): the pgTAP file `record_form_submission.test.sql` (25 checks) and the integration test `forms.test.ts` run in CI. The migration reaches `findsprop-dev` only after the merge, through `db-deploy`.
- Not built: the renderer, `/contact` and its built-in default form, the file uploads, and a project's assigned form.
