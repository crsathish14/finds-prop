# ADR-183 · The wording of the enquiry mails is edited by the super admin

- Status: Accepted for part A (the server: storage, rules, render function, defaults). Part B (Design Lab parts) is described below. Part C (the admin screen "Emails") is described at the end. Plan approved by the owner on 24 Nov 2026 ("Approve, start PR 1"; PR 3 of the plan in `ENQUIRY_EMAIL_PLAN.md`).
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

## Part B: the editor's boxes (Lab parts)

- `MailTemplateFields` and `MailTemplatePreview` (`src/components/domain`) are the boxes for one mail and the preview under them. They hold no state and take their words as props. They are shown on the Site content board of the Design Lab (entry `mail-template-fields`) in the states: standard wording with preview, live with a draft waiting, empty, with problems, at the limits and while publishing.
- **No approved UX exists for this screen.** The parts reuse the form section, the form field, the legal editor's save bar (Discard, Save draft, Publish) and the Site content boxes; nothing new is invented in the look.
- **The preview is the real mail:** the Lab (and part C) fill the typed wording with `renderMailTemplate` and made-up values (`MAIL_SAMPLE_VALUES`), so the preview and the sent mail cannot differ. When the typed wording cannot be used, the preview shows the wording in code and says so.
- **The list of words** shows each placeholder as written in curly brackets with a short description; the required one is marked.

Words to confirm (part B): "Mail to the poster"; "Confirmation to the enquirer"; the two descriptions; Subject; Message; "One line, as the mail's title."; "Plain text. Line breaks are kept."; "{used} of {max}"; "Words you can use. They are filled in when the mail is sent."; "Required."; the placeholder descriptions (The name the enquirer typed; The title of the home or project; The public page of the home or project; Your enquiries or leads page; The name of the site); "Preview with made-up values"; "This wording cannot be used yet, so the standard wording is shown here."; "Save draft keeps your changes private. Publish makes this wording the one that is sent."

## Part C: the admin screen "Emails"

- **Where:** `/admin/emails`, with an **Emails** entry in the admin sidebar under Content. Only a super admin reaches it (the role gate in the admin layout), and only a super admin can save (the action). It is not a tab of Site content: it has its own heading and no tabs.
- **What it shows:** the two mails, each in its own form: the subject and message boxes, the list of words that mail may use (the enquirer name marked required), a preview, and the bar with Discard, Save draft and Publish. A line above each says whether the mail still uses the wording in code, is live since a day, and whether a saved draft is waiting.
- **The preview is the real mail:** it is filled in by `renderMailTemplate` with `MAIL_SAMPLE_VALUES`, in the browser, as the boxes change. When the typed wording breaks a rule it shows the wording in code and says so, as the mail itself would.
- **Saving:** Save draft is the form's submit (so Enter in a box never publishes); Publish is its own button. Both are off while a save is pending. A problem the server names (unknown word, missing enquirer name, empty, too long) is put on its box; any other failure is a toast; the page is read again after every save and opens fresh on what is saved (it is keyed on what was read).
- **Where the code lives:** `mail-templates-form.client.tsx` in the `mail-templates` feature, because nothing in it needs Site content; it keeps its own small save flow instead of importing Site content's.
- **Audit:** unchanged, the database's `cms.changed` entry (which setting, who, never the text).

Words to confirm (part C): the sidebar entry "Emails"; the page title "Emails" and its line "Edit the wording of the emails sent when someone sends an enquiry. Plain text only. Save draft keeps your changes private; Publish makes the wording the one that is sent."; "It never holds a phone number or the enquiry message." (in the poster mail's description); "{used} of {max} characters"; status lines "Not published yet. The standard wording is sent.", "Live since {day}.", "Live now." and "You have a saved draft that is not live yet."; the toasts "Draft saved" / "The mails still use the live wording." and "Published" / "The new wording will be used for the next mail." The box and Lab words are listed under part B.
