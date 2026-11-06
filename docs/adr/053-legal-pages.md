# ADR-053 · Legal page shells and consent hooks (S5-T06)

- Status: Accepted
- Date: 2026-11-06
- Related: ADR-035 (text in `en.json`), ADR-047 (SEO and metadata), `docs/ux/ux-addendum/screens/legal-page.html` and `consent-snippets.html` (ADD-12), FR-SYS-09, DEC-25
- Plan approved by the owner on 6 Nov 2026, "All recommended": typed content files, a draft notice with no indexing, the project card's consent line now (flagged), no footer link yet, and the sitemap only once the text is final.

## Decision

- **One reading layout for the three pages** (`src/features/legal`): the breadcrumb, a switch between Privacy Policy, Terms of Use and Cookie information, the title with the Legal tag, "Last updated" and the version when there are some, a summary, and numbered sections beside an "On this page" list. From 1024 px the list is a sticky column; on a phone it is a closed list (`<details>`, no script). Tables (what is collected, which cookies) are real tables with a caption and header cells and scroll sideways when narrow.
- **The text is in typed content files** (`content/privacy.ts`, `terms.ts`, `cookies.ts`), not in `en.json`. This departs from ADR-035 for these three pages only: long legal text with tables and numbered sections is a document, not a message, and the owner writes and reviews it as a document (DEC-25). The words of the page itself (the tag, "On this page", the draft notice, the titles) are in `en.json`. The content files are the one place visitor-facing text lives outside `en.json`; the lint check is on messages in components and does not read them.
- **The text is a placeholder for now.** Each document says `draft: true`. A draft page shows a notice ("This text is a placeholder and is not legal advice. The final text will replace it."), is kept out of search results (`noindex`) and is not in the sitemap. To publish, the owner's text replaces the bracketed sentences and the file sets `draft: false`, `updated` (a day) and `version`; the notice goes, the date and version show, and the page indexes normally.
- **The cookie table lists what the code really stores today**, for the owner to check: the sign-in session, the human check on sign-in, the compare list, a home waiting to be saved, and the "Later" choice on the email prompt. There is no analytics and no optional cookie, so **no cookie banner or settings were built**.
- **Consent hooks:** the sign-in screen (already links Terms and Privacy) and the enquiry card carry their consent lines; the project card gets its own under Send (the UX text, naming the developer; "the developer" when no name is given). All link to `/privacy`. The contact form and Post a property get theirs with those tasks; the address-search provider note belongs to S4-T05, which was left out.
- **No link to Cookie information in the footer yet** (owner's decision), and **the sitemap does not list the legal pages** until the text is final.

## Consequences

- `/privacy`, `/terms` and `/cookies` are real pages; the footer, sign-in and enquiry links now lead somewhere. Until the owner's text exists, they show placeholders and a draft notice.
- **All placeholder text and every new word is unapproved** (flagged in the pull request); the project card's consent line is the UX text and is a stop-and-ask item, built at the owner's instruction.
- The Design Lab Discovery board gets a "Legal pages" entry (three pages and the open phone list); its pictures come from CI after the owner approves them.
