# ADR-106 · Sponsor management: the picture slot and the sponsor form (S7-T11, part B1)

- Status: Accepted
- Date: 2026-11-09
- Related: ADR-105 (the server side and the picture rules), ADR-045 (the banners on the pages), ADR-087 (the project form parts, whose pattern of presentational parts with words passed in this follows), FR-ADM-11, DEC-15
- Plan approved by the owner on 9 Nov 2026 ("approved", all seven recommended answers). S7-T11 is built in four changes: the server side (ADR-105); these Design Lab parts (B1); the sponsors table, the layout warnings and the hero preview with a banner (B2); the sponsor manager on the Hero page (C).

## Decision

- **Parts first, in the Design Lab, two entries on a new board, "Sponsors".** The Site content board had grown too tall to photograph comfortably (its 390 px picture is about 44,000 px high), so the sponsor parts have their own board and page (`/design-system/sponsors`, mirroring the approved admin Hero and sponsors screen); the other boards' pictures are not changed. No page is connected here. Like the other admin parts, none of them holds state of its own (the page keeps the values, the files and the words, already translated).
  - **`SponsorImageSlot`** (domain): one of a sponsor's four picture slots (strip or panel, desktop or phone): its name, the size it is shown at, a preview at the slot's true shape (nothing stretched), the status of the chosen file and the buttons that fit. The empty preview is the file picker, so a file can be dropped on it or chosen with the keyboard. States: empty; filled ("Fills the slot", with the picture's size and weight); near (8 to 30 percent off the slot's shape: accepted, shown whole on a plain background, with a notice and Keep as is); refused (an alert with the reason and Choose another file; the picture is shown when there is one so the person can see why, otherwise the file's name); checking (busy, nothing can be pressed or dropped); off while saving. Each button's name says which slot it is for ("Replace: Strip · desktop") because four slots sit on one form.
  - **`SponsorFields`** (domain): the body of the Add sponsor and Edit sponsor drawer: advertiser name (staff only), alt text, destination link, the Active switch (the whole row is its click target, its line is read with it) and the four slots with the heading and notes of the approved screen. One column at every width, as the drawer is narrow.
- **The name is not `SponsorSlot`**, which is already the public banner area (`components/layout/sponsor-slot.tsx`); two shared components with one name would be a trap.
- **No checks in the parts.** The page will run the rules (type, 150 KB, twice the size, the shape) before sending a file, and the server runs them again on the stored file (ADR-105); the part only shows what it is told.
- **The sample pictures are the approved UX stand-ins** (SVG, in `public/design-lab/ads`), which the real form would refuse. One specimen takes a real file from the visitor's computer and shows it, to try the picker; nothing is sent.
- **A small test change:** the registry test required every board's UX file to be under `docs/ux/final-ux/screens`. The sponsors screen is one the UX addendum added, so it is in `docs/ux/ux-addendum/screens`; the test now accepts either folder, still requiring the file to exist and the reference table to name it.

## Wording to confirm

From the approved screen and used as written: "Advertiser name", "Name shown to staff only", "Alt text", "Describe the banner for screen readers", "Read aloud by screen readers. Describe what the banner says, not just "banner".", "Destination link", "https://", "Opens in a new tab. Must start with https://.", "Active", "Inactive sponsors are never shown.", "Banner images", the pictures' notes ("Shown at 970 × 90 · supply 1940 × 180" and the other three), "Drop an image here", "or choose a file", "Choose file", "Replace", "Remove", "Choose another file", "Keep as is", "Fills the slot", "Will be shown whole on a plain background" and its line, the four "Rejected: …" lines, and the closing line "Supplying both the desktop and phone image of a format makes it ready. A sponsor with no ready format is never shown." Differences and additions, for your confirmation:

- The pictures' heading line says "up to 150 KB each" without the screen's "Limits to confirm · DEC-15" flag, which is a review note (you confirmed 150 KB).
- New: "Checking the picture" (while a chosen file is read and sent), "Preview of the chosen picture" (the description of a preview that has none of its own), and the buttons' accessible names ("Replace: Strip · desktop" and the like).

## Consequences

- No migration, package, gate, environment or server change. A new Design Lab board with two entries: its page, its row in `docs/ux-reference.md`, its registry entry and the two e2e lists that name the boards (the count in the index test is now eleven). Three new pictures, taken in CI at 390, 820 and 1440 px and committed as baselines after your approval. An eleventh board may make the board-link row wrap onto another line at 820 px as the tenth did; if it does, the existing 820 px baselines would need regenerating once, and I will tell you before doing that.
- Rollback: delete the two parts, the demos, the board with its page, row and registry entry, the e2e board names, the tests, the registry test change and this ADR. Nothing else uses them yet.
