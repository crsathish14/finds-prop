# ADR-096 · The builder portal: the company profile (S7-T03, step D)

- Status: Accepted
- Date: 2026-11-09
- Related: ADR-094 (the `builder_edit` limit), ADR-095 (the Units and Leads pages), ADR-017 (column grants on `builders`), FR-BLD-05, BR-31
- Plan for S7-T03 approved by the owner on 9 Nov 2026 ("T03 approved").

## Decision

- **One action, `updateMyProfile`, run as the builder.** It takes the six boxes of the UX screen `builder-profile` (company name, contact person, phone, logo link, website, about) and nothing else: no type, no email, no id. Whose profile it is comes from the session (`my_builder()`), never from the request. The role is **builder** (an agent too), and the action is limited with the builder's other edits (`builder_edit`, 300 an hour, ADR-094).
- **The database decides.** The action uses the builder's own client, not the service role. `my_builder()` finds their record; the update policy `builders_update_own` and the column grant (`name, contact_person, phone, logo_url, website, description`) let them change those columns of that record and no other. The type, the login email and whether the account is active stay the admin's. A blank optional box clears the field.
- **No approval and no audit entry.** The UX says "Changes to your profile don't need approval". The database records activation and type changes of a builder, not the company's own description of itself, so the action has no `audit` entry either; the admin's `updateBuilder` has none for the same reason.
- **What it refreshes.** The same tags as an admin edit (`projects`, `home-projects`): the developer showcase and the builder's name and logo on project pages.
- **The page.** `/builder/profile` shows the details form (the admin's `BuilderForm`, in its edit mode, with a new `showKind` setting that leaves out the Type box; the login email is read-only) and the card buyers see in the developer showcase (`DeveloperCard`), which follows what is typed. The card's count is the builder's approved, published projects, read as the builder. The page reads the record with `getMyProfile()`; an account with no active builder record gets "not found".
- **Wording.** Everything is from the approved UX screen (title, line, "Details", the email hint, "Save profile", "Saving", the note, "How it looks to buyers", the card note, "Profile saved"); the labels are the admin's existing `admin.builders.form` words. Nothing new for the owner to confirm.

## Consequences

- One action, one save function, one read, one page component, one optional setting on an existing component, and their tests (unit tests of who may call it and what it writes; a component test of the page; an integration case, run only in CI, that a builder saves their own profile and cannot change the email, the type or another builder's record). No migration, package, environment, CI or protected-file change.
- Rollback: delete the action, the save function, the read, the page component and the `showKind` setting, and put the placeholder page back. Profiles already saved are ordinary rows.
