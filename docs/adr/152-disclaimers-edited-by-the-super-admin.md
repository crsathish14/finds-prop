# ADR-152 · The footer and AI search disclaimers are edited by the super admin

- Status: Accepted (owner change request, 22 Nov 2026; autonomy rule of the same day)
- Date: 2026-11-22
- Related: ADR-089 and ADR-090 (site content settings), ADR-151 (legal pages edited by the admin; same storage), FR-ADM-10, BR-81
- Class: C1 (a new key in an existing store; no migration)

## Decision

- **Two plain-text disclaimers:** one shown in the footer of every public page (above the copyright line), one shown under the chat on `/ai-search`.
- **Storage:** one more key of the existing `site_settings` table, `disclaimers`, with value `{ footer?, aiSearch? }`. This is the same table and key rule ADR-151 uses for the legal pages, so no migration, no new policy, and the existing audit trigger records that the setting changed and by whom (never its text).
- **Who edits, where:** only a super admin, with the same `admin_edit` limit as the other site content, on a new **Disclaimers** tab of Site content (`/admin/disclaimers`).
- **Empty state:** there is no built-in wording. A missing or empty disclaimer shows nothing and leaves no gap. The owner writes the text; the tool does not draft or check legal content (DEC-25).
- **Length and content:** at most 600 characters each (the same limit on the public read and on the save). Plain text: line breaks are kept, every other control character is refused, and anything typed is shown as text, never as markup.
- **Caching:** the public pages read the cached site content (`getSiteSettings`, tag `site-settings`); every save refreshes that tag, so a change shows straight away. A stored row that does not match its shape is ignored (BR-81).
- **Not done here:** the legal pages' editor (ADR-151, parts B to D) stays its own work; this ADR reuses its storage choice, not its code.

## Consequences

- All words of the editor screen are unapproved until the owner reviews them.
- The footer is read from cached content, so it stays part of the page's static shell.
