# ADR-101 · Site content: the Header and Footer pages (S7-T10, part C1)

- Status: Accepted
- Date: 2026-11-09
- Related: ADR-089 (the server side: the four save actions), ADR-090 (the frame, the link list and the Header and Footer parts), ADR-099 (the Hero and Homepage parts), FR-ADM-10, BR-81, BR-83
- Plan approved by the owner on 9 Nov 2026 ("approved"). This is the first of the two page changes; the Hero and Homepage pages follow.

## Decision

- **`/admin/header` and `/admin/footer` are now the real pages** (they were placeholders). Each page is a thin server page that reads what is saved as the signed-in admin (never cached, so an editor always opens on the latest save) and hands it to a client form in the `site-content` feature (`HeaderForm`, `FooterForm`) together with the save action built in part A (`saveHeader`, `saveFooter`). No server change: the actions, the rate limit, the cache refresh and the audit are ADR-089's.
- **The forms keep what is typed and nothing else.** A save sends the boxes to the action. A problem the server pins to a box (`links.2.href`, `cta.label`, `contact.email`) is put on that box in words from the message catalogue, with an alert on top that counts them ("2 things need attention") and is brought into view; any other failure (not allowed, too many saves, the server) is a toast, and the page is read again so it shows what is really saved. A good save shows a toast and reads the page again. **Discard** puts the boxes back to what was loaded.
- **The boxes start on what visitors see today.** With nothing saved, the Header page opens with the standard links and the standard button in their boxes (and the Footer page with the standard links), so the admin edits from what is there instead of from a blank list. The standard values are worked out on the server with the same builders the public header and footer use (`buildHeader`, `buildFooter`: the default links, the default button, the default copyright line, the links hidden by a feature flag), so they cannot drift apart from the real pages. A saved value is shown as saved, never mixed with the standard. The site name and the copyright line start empty when nothing is saved, and the pictures show the standard ones.
- **The little pictures follow the same two rules as the public pages**, applied in the browser as the boxes are typed: an empty list or box means "use the standard" (BR-81), and a link with no name yet is left out. The browser cannot call `buildHeader` itself (the `site` feature's entry point also holds server code, and another feature may only import it through that entry point), so the page passes the standard model in and the picture applies the rule. This is the one place where the rule exists twice; the tests cover both sides.
- **One small addition to the `site` feature:** `getCurrentYear` (the cached year behind the footer's copyright line) is exported from its entry point, so the Footer page can work out the standard copyright line.
- **Messages:** a new group `admin.siteContent` in `en.json` (page headings, box labels, the save bar, the toast and alert words, the link list's words). The tab names and the "Site content" navigation name reuse `admin.nav`.

## Departures from the parts' Lab wording (ADR-090), for you to confirm

- **The button line.** The Lab said "Leave both boxes empty for no button." That is not what happens: with both boxes empty nothing is saved for the button, and the public header then shows its standard button (Post property), by BR-81. The page says **"A button at the right end of the header. Leave both boxes empty to use the standard button."** There is no way to remove the button altogether; that would be a new setting and is not in the approved design. The Lab specimen still carries the old line; it will be corrected the next time that board's pictures change, so as not to ask you to approve three more pictures for one sentence.
- **The footer links line** gains a second sentence, because an empty list also means the standard links: **"Shown in the footer, in this order. Leave the list empty to use the standard links."**

## Wording to confirm

New, in `en.json` under `admin.siteContent`: the page titles for the browser tab "Site content: Header" and "Site content: Footer"; the line under the site name "Leave the name empty to use Find Prop."; the toasts "Header saved" and "Footer saved" with "The change is live on the public site."; the alert "1 thing needs attention" / "N things need attention" with "Check the boxes marked below, then save again."; the two lines above; and the words already listed in ADR-090 (the cards, "Add link", "No links yet.", "The list is full.", "Discard", "Save changes", "Saving", "Saved changes appear on the public site straight away.").

## Consequences

- No migration, package, gate or environment change. New: `form.ts` (the pure rules), `save-flow.client.tsx`, `header-form.client.tsx`, `footer-form.client.tsx`, two queries (`getHeaderPage`, `getFooterPage`), the two pages, the message group and tests (the rules on their own; the two forms with a stand-in save action: what they open with, the picture following the boxes, what a save sends, problems on their boxes, a failure toast, saving, Discard). No Design Lab change and no new pictures.
- The Hero and Homepage pages (next) use the same save flow.
- Rollback: restore the two placeholder pages and delete the files above, the message group and this ADR. The saved settings are untouched.
