# ADR-055 · The form renderer and the contact page (S5-T05, second change)

- Status: Accepted (renderer and contact page); the uploads and the project's assigned form are the next changes
- Date: 2026-11-06
- Related: ADR-054 (the forms backend), ADR-035 (text in `en.json`), ADR-048 (cache tags), ADR-047 (SEO and metadata), FR-PUB-11, FR-ADM-08, BR-60 to BR-63, `docs/ux/final-ux/screens/contact.html`, `consent-snippets.html` (ADD-12)
- Plan approved by the owner on 6 Nov 2026, "All recommended": the default contact form is stored by a migration and the page shows "Could not load" when no active contact form exists; the attachment field and its consent sentence wait for the uploads; the dev-only `seed.sql` is left as it is.

## Decision

- **`DynamicForm`** (`src/components/domain/dynamic-form.tsx`) draws any stored form from its field list: text, number, email, dropdown, radio, checkbox (a group when it has options, one box when it has none), textarea and date. It is the screen only (like the enquiry card): it holds what is typed, shows the errors it is given beside each field, keeps what was typed when a send fails, and hands the values over by field key. A **file** field draws nothing yet: the server takes no answer for one (ADR-054), so a control would do nothing. The upload step is its own change.
- **`ConnectedForm`** (`src/features/forms/connected-form.client.tsx`) connects it to the action `submitForm`, passed in by the page (a client file cannot import the feature's server code). It makes one idempotency key when the form opens (a retry sends the same key), and maps the answer: sent, field messages (a key the form does not have is ignored), "limit reached" for a rate limit, and "could not send" for anything else, including a request that never arrived.
- **The default contact form is a stored form.** `record_form_submission` accepts only a stored, active form, so the migration `20261106140000_default_contact_form.sql` inserts one (`slug contact`, placement `contact`) with `on conflict (slug) do nothing`. `CONTACT_FORM` in code holds the same fields, read through the same schema as a stored form, for the Design Lab and tests; a unit test reads the migration and fails if the two differ. The admin form builder (Stage 7) edits the stored copy. The five fields: name and mobile (needed), email, "I'm interested in" (five choices) and message (optional, at most 1000 characters).
- **`/contact`** reads the active form placed on the contact page (the most recently edited when there are several) through `getContactForm`, cached for minutes under the new tag `forms` (`CACHE_TAGS.forms`, `tagsAfterFormChange`; the form builder will use it). A form that cannot be read, or whose stored fields do not fit, gives the page's "Could not load the contact form" notice with Refresh; that answer is cached for seconds only, so the page recovers by itself. The page is open to visitors (no sign-in) and is indexable.
- **"Reach us directly"** takes the address, phone and email from the footer settings through `buildFooterContacts` (extracted from `buildFooter`, so the footer and the page cannot differ). Only the lines that are set show; with none, the column is left out and the form keeps a reading width.
- **Consent line:** "We use these details only to reply to you. Privacy Policy" (link to `/privacy`), the UX placeholder without its attachment sentence ("Files you attach are visible to Find Prop staff."), which arrives with the uploads. The wording is **not approved** and is flagged in the pull request.
- **Tests in the database changed:** the new form is an active, contact-placed row in every database, so `forms_submissions.test.sql` counts one more active form, and two tests that created a form with the slug `contact` use another slug.

## Consequences

- The page works once the migration is applied to a database (`db-deploy` after the merge). Before that, and in the CI smoke run (no database), it shows the "Could not load" notice; the smoke test accepts either.
- Nothing is sent to a CRM or by email: the delivery is Stage 7. A submission is stored with its visitor hash and the page it was filled on.
- All wording is new and not approved: the page title and lead, the sent and could-not-load notices, "Reach us directly" and its labels, the renderer's "Choose an option", "Send", "could not send" and "limit reached" notices, the consent line, and the SEO title and description. Most are the UX screen's words.
- The sitemap does not list `/contact` yet (it lists the homepage, search and projects); adding it is a separate, small change for the owner to ask for.
- Not built: file uploads (change 3) and a project's assigned form with its sign-in gate (change 4).
