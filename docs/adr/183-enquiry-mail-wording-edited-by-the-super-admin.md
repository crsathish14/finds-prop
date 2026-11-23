# ADR-183 · The wording of the enquiry mails is edited by the super admin

- Status: Accepted for part A (the server: storage, rules, render function, defaults). Parts B (Design Lab parts) and C (the admin screen "Emails") follow in their own pull requests and add their sections here. Plan approved by the owner on 24 Nov 2026 ("Approve, start PR 1"; PR 3 of the plan in `ENQUIRY_EMAIL_PLAN.md`).
- Date: 2026-11-24
- Related: ADR-181 (the Resend sender and the settings), ADR-151 (legal pages edited by the admin: the same draft and publish storage), ADR-152 (disclaimers), ADR-089 (site content settings), ADR-074 (mail hook points), R-BE-10 (no personal data in logs), FR-ADM-17
- Class: C2 (a new saved shape and wording that reaches people by mail)

## Decision

- **Who edits:** only a super admin, with the same limit as the other site content (`admin_edit`).
- **Two mails:** `enquiry_poster` (to whoever posted the home or project: "you got an enquiry from ...") and `enquiry_sender` (a confirmation to the enquirer who typed an email). Each has a **subject** and a **body**, plain text only.
- **Where it is stored:** two rows of the existing `site_settings` table, `mail_enquiry_poster` and `mail_enquiry_sender`. **No migration:** the key rule (`^[a-z][a-z0-9_]*$`), the policies (public read, super admin write) and the audit trigger (`cms.changed`: which setting and who, never its text) already cover them. The rows are public to read, like every site setting, so they hold only wording: no address, no name, no phone number, no enquiry text. A test keeps the stored shape to `subject`, `body` and a day.
- **Public reads are not widened:** the site's own read still asks for its known keys only (`.in("key", ...)`), so these rows are never fetched with the header and footer. The mail code reads them with its own call for exactly the two keys.
- **Two copies per mail, one row:** `{ published, working }`, as ADR-151. **Save draft** writes `working` and never changes what is sent. **Publish** writes `published` with today's day in India and removes the working copy. The editor opens on `working`, else `published`, else the wording in code. There is no version history, and no "reset to the wording in code" button (the admin can paste it back).
- **The wording in code is the fallback.** Until something is published, and whenever a saved row does not match its shape or breaks a rule, the mail is written from `DEFAULT_MAIL_TEMPLATES` in `src/lib/mail-template.ts`, so mail works before the admin has edited anything and a bad row can never produce a bad mail.

## Placeholders and limits

Words in curly brackets are filled in when the mail is written. Only these are allowed; anything else, including a different spelling or spaces inside the brackets, is refused:

| Placeholder       | Filled with                            | Poster mail       | Enquirer mail |
| ----------------- | -------------------------------------- | ----------------- | ------------- |
| `{enquirerName}`  | the name the enquirer typed            | yes, **required** | yes           |
| `{propertyTitle}` | the title of the home or the project   | yes               | yes           |
| `{propertyLink}`  | the public page of the home or project | yes               | yes           |
| `{dashboardLink}` | the poster's enquiries or leads page   | yes               | no            |
| `{siteName}`      | the site's name                        | yes               | yes           |

- **Required:** `{enquirerName}` must appear in the subject or the body of the poster mail, so the poster is always told who wrote. The enquirer mail has no required placeholder.
- **Limits:** subject 120 characters, body 2000. Plain text: a body may have line breaks; a subject may not; every other control, format or private-use character (a bell, a right-to-left mark) is refused. Nothing is interpreted as markup.
- **The same rules everywhere:** `mailTemplateProblems` in `src/lib/mail-template.ts` is the one list of rules. The editor's schema, the check on a stored row and the render function all use it, so the editor cannot save wording the mail would refuse to use.
- **Why the code is in `src/lib`:** the render function is pure and the admin screen (part C) runs it in the browser for its preview, and a browser island may not import `server/`. `src/server/mail/render-template.ts` hands the same function to the mail code, and `src/server/mail/index.ts` exports it with one line.

## Rendering

`renderMailTemplate(kind, template, values)` returns `{ subject, text, fellBack }`. It sends nothing and reads nothing; the next part of the plan finds the template and the values and gives the result to a `MailSender`.

- Values are cleaned first: every control or format character and every run of white space becomes one space, so a name with a line break in it cannot add a line to the subject or a header.
- One pass over the template: a value that itself holds `{siteName}` is not filled in again.
- A template that breaks any rule is **not used**; the wording in code is filled in and `fellBack` is true so the caller can log "a saved template was not usable" (never the text). So is a template whose filled-in subject or body would be empty. A mail never leaves with a raw `{placeholder}` in it.
- `getMailTemplates()` (cached for minutes under the site content tag, which every save refreshes) gives the mail code the published wording of both mails, falling back to the wording in code when the read fails (logged with the error code only).

## Default wording (unapproved)

- Poster: subject "You got an enquiry from {enquirerName}"; body says that someone named {enquirerName} sent an enquiry about {propertyTitle} on {siteName}, and gives {dashboardLink} and {propertyLink}.
- Enquirer: subject "We sent your enquiry about {propertyTitle}"; body greets {enquirerName}, says the enquiry about {propertyTitle} was passed on to the owner (no promise that they will reply), and gives {propertyLink} and {siteName}.
- **No phone number and no enquiry text appears in either**, and no placeholder exists for them.

## Consequences

- Part A has no visible change: nothing sends yet (the calls from the enquiry actions are part 4 of the plan) and there is no screen until part C.
- The save action `saveMailTemplate` is super admin only; it refreshes the site content tag. The database audits the change.
- **All wording is unapproved until the owner reads it:** the two default mails, the two schema messages below, and, in parts B and C, every word of the screen.
- A published template can still be a poor mail (the owner may remove the dashboard link). The rules protect against broken and unsafe mail, not against wording choices.
- Rollback: remove the `mail-templates` feature, `src/lib/mail-template.ts` and the export line in `src/server/mail/index.ts`. The rows in `site_settings` are harmless if left.

## Draft wording for the owner to approve

| Where                          | Words                                                                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Poster mail, subject           | You got an enquiry from {enquirerName}                                                                                                                                                  |
| Poster mail, body              | Hello, / Someone named {enquirerName} sent an enquiry about {propertyTitle} on {siteName}. / Open your dashboard to see it: {dashboardLink} / The page they asked about: {propertyLink} |
| Enquirer mail, subject         | We sent your enquiry about {propertyTitle}                                                                                                                                              |
| Enquirer mail, body            | Hello {enquirerName}, / We have passed your enquiry about {propertyTitle} on to the owner. / You can look at it again here: {propertyLink} / {siteName}                                 |
| Problem on a box (not allowed) | This wording uses a word in curly brackets that is not allowed here. Use only the words listed beside the boxes.                                                                        |
| Problem on a box (missing)     | Add the enquirer name word from the list beside the boxes, so the owner can see who wrote.                                                                                              |
