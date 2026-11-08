# ADR-076 · Admin builders: the Design Lab parts and the wording (S7-T05, part 2)

- Status: Accepted
- Date: 2026-11-08
- Related: ADR-075 (the server side and the Google-only invitation), ADR-010, ADR-020 (Design Lab), ADR-035 (message keys), FR-ADM-04
- Plan approved by the owner on 8 Nov 2026 ("all recommended"): no email in v1, the sign-in address is shown after inviting, the password wording of the approved screen is replaced, the new words are flagged for confirmation.

## Decision

- **Three new domain parts, three Admin board entries.** `BuilderTable` (a table from 1024 px of room and cards below, with the company and its login email, the state, projects, leads, the last sign-in and the row's actions), `BuilderForm` (the invite and edit fields; in edit mode the login email is shown and cannot be changed) and `SignInAddress` (the address to pass on, with a Copy button that says Copied). They hold no state and take their words as props.
- **Reused parts:** `Sheet` (the drawer), `DropdownMenu` (the row menu), `ConfirmDialog` (deactivate), `EmptyState`, `FormField`, `Input`, `NativeSelect`, `Textarea`, `Badge`. The state is a `StatusBadge` of a new kind `builder` (Active green, Invited amber, Inactive grey), so a status keeps one colour everywhere (R-DS-09).
- **A table component for all admin pages is still S7-T01.** `BuilderTable` is specific to builders, as `ListingQueue` is to listings.
- **The agent is shown with an "Agent" badge** beside the name; a builder has none (the type was decided after the approved UX was drawn).
- **Not in this change:** the connected page, the messages in `en.json` and the actions' answers on screen (part 3).

## Wording to confirm

Plain English in the Design Lab now; part 3 puts the same words in `en.json`. From the approved UX file: the heading "Builders" and its line, "New builder", the six column headings, "Active", "Inactive", "Invited", "Hasn't signed in yet", "Edit", "Edit details", "Deactivate" and "Activate", "Resend invitation", "{n} builders", "Builders can be deactivated but not deleted.", "No builders yet", the deactivate question and its line, "Company name", "Login email", "Contact person", "Phone", "Logo link", "Website", "About", "Cancel", and "This email can't be used for a builder account." The approved screen also says "Send password link", "set a password" and "Send invitation"; those are replaced because builders sign in with Google only (ADR-010). New, for your confirmation:

- The empty page line: "Invite a builder and share the sign-in address with them." (the UX says "they will get an email to set a password").
- The invite drawer: its title "New builder", its line "They sign in with Google, so no password is needed.", the button "Invite builder", and the email hint "They sign in with Google using this email."
- The type: "Type" with "Builder" and "Agent", and the "Agent" badge.
- The edit drawer's email hint: "The login email cannot be changed."
- After inviting: the title "Builder invited", the line "Nothing is emailed. Pass this address on to them.", "Ask {email} to sign in with Google using that same email.", the label "Sign-in address", the buttons "Copy address", "Copied" and "Done", and the hint "They must use the Google account with the email above."
- The toast: "Builder invited" with "{email} can now sign in with Google." (the UX has "Invitation sent" with "can now set a password").
- The row menu's "Edit details" and "Resend invitation" keep the UX words; "Resend invitation" now shows the address again instead of sending a mail.

## Consequences

- No migration, package, gate or environment change. Three parts, a status kind with its three words (`status.builder.*`), and three Design Lab entries; the Admin board's three pictures change (the entries make it longer) and are added from CI after the owner approves them.
- The drawer opens from a button in the Design Lab and is not part of the pictures (an overlay), as with the other dialogs and drawers.
- Rollback: delete the three parts, their entries, their tests and the `builder` status kind. Nothing is destroyed.
