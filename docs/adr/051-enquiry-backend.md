# ADR-051 · The enquiry backend (S5-T03, first change)

- Status: Accepted (backend); the card, the sheet and the My enquiries tab are the next change
- Date: 2026-11-06
- Related: ADR-046 (the project lead, whose pattern this follows), ADR-018 (rate limiting), `docs/engineering/security.md` 4.3, FR-ACC-03, BR-50, BR-70, DEC-26, DEC-33
- Plan approved by the owner on 6 Nov 2026 with the recommended answers: two changes (this backend, then the card and the tab); a second enquiry about the same home within 24 hours is shown as "already sent"; an owner may not enquire about their own home; a home that is no longer listed keeps a generic row in My enquiries; the phone field is prefilled and editable; the consent line is built only after the owner approves its text. **On the way in, the owner also approved the one-line allow-list entry in `eslint.config.mjs` and the one row in `security.md` 4.3** (a Gate-change, listed in the pull request).

## Decision

- **`submit_enquiry(short_id, user_id, name, phone, email, message)`** stores one enquiry and returns its id. It is the only way in (enquiries have no client insert) and execute is granted to `service_role` alone, so a signed-in user cannot call it with another user's id (BR-50). The home is named by its public short id and must be approved: anything else (never listed, in review, sold, withdrawn, no such id) is `P0002`, "not found". The owner may not enquire about their own home (`42501`). A second enquiry by the same user about the same home within 24 hours is a duplicate (`23505`, `enquiry.duplicate`) and stores nothing; the same user and home are serialised with an advisory lock, so two requests at once cannot both pass the check (DEC-26). The table's own checks (name 2 to 80, phone 6 to 15 digits, email 254, message 1000) still apply and come back as `23514`.
- **The action `sendEnquiry`** needs a signed-in visitor with a verified phone, counts the existing `enquiry` limit (10 per user per day, BR-70) and carries a one-time key (R-BE-05). Nothing in the request says who is sending: the sender is the session's account. The server maps the database's answers to the closed set of codes: not found, conflict (already sent), forbidden (own home), validation, or internal.
- **The phone** is taken from the form (a plain number of 6 to 15 digits; spaces, dashes, brackets and a leading plus are dropped). The next change prefills it from the sign-in number and leaves it editable, so a person can give the owner a different number to call.
- **Service-role allow-list:** `src/features/enquiries/service.ts` is the only module that holds the service-role client for this, as `projects/service.ts` does for leads. It is named in `eslint.config.mjs` and in `docs/engineering/security.md` 4.3.
- **Hand-written types:** the Docker-free machine cannot run `gen-types`, so the function's entry in `src/types/database.types.ts` was written by hand in the generator's format; CI's `gen-types --check` confirms it.

## Consequences

- Nothing is visible yet: the property page's Send stays switched off until the next change.
- Not tried against a real database here (no Docker): the pgTAP file `submit_enquiry.test.sql` (18 checks) and the integration test `enquiries.test.ts` run in CI. The migration reaches `findsprop-dev` only after the merge, through `db-deploy`.
- Not built: the card and sheet wiring, the consent line (a stop-and-ask wording), the My enquiries tab.
