# ADR-113 · Sponsor management: the manager on the Hero page (S7-T11, part C)

- Status: Accepted
- Date: 2026-11-10
- Related: ADR-105 (the server side), ADR-106 (the picture slot and form), ADR-109 (the list, the preview and the layout notes), ADR-102 (the Hero page), FR-ADM-11, DEC-15
- Plan approved by the owner on 10 Nov 2026 ("approved") as two changes: C1, the logic that has no screen (this ADR's decisions), and C2, the connected Hero page (its wording is added to this ADR there). The owner's decisions of 9 Nov 2026 stand: every sponsor is eligible for the hero and for results, the advertiser's name is kept for staff only, there is no "Booking" line, the server removes the files of deleted or replaced pictures, there is no approval step, and scheduling, billing, reports and click counts are not built.

## Decision (C1: the logic, no screen)

- **One list of drafts, in the browser.** The Hero page keeps the sponsors as a list of drafts (`sponsor-draft.ts`): the stored sponsors as the server read them (`getSponsorsPage`), changed by Add, Edit, Delete, Move and Active. Each change gives a new list and is then sent as the whole list in its order, which is what `saveSponsors` takes. The rules are plain functions with tests: at most 10 sponsors (a full list cannot be added to), Move swaps with the neighbour and stops at either end, and the status is "Needs images" until a format has both pictures.
- **The browser checks what the server checks, and the server still decides.** `checkPicture` (`sponsor-upload.ts`) reads the start of the chosen file and applies the server's own rules (`slotProblem`): a PNG, JPEG or WebP by its own first bytes (a name or declared type proves nothing), no more than 150 KB, at least twice the slot's size, and a shape the slot can take (a near miss is accepted and shown whole). The person is told at once, in the slot, before anything is sent. `draftProblems` finds the box problems (a name, an alt text, an https link with no user name or password) and a format that has only one of its two pictures, with the same `validation.*` keys the server uses.
- **A picture is sent when the sponsor is saved, not when the file is chosen.** A chosen picture is held as the file itself, with a preview address the browser made. Pressing "Save sponsor" puts each new file in the public bucket `site-assets` under `sponsors/<the sponsor's id>/<random name>.<ending>` with the signed-in admin's own session (`sponsor-storage.ts`; the bucket's policies allow only the super admin to write), and then calls `saveSponsors` with the paths. A drawer that is cancelled therefore leaves nothing in the bucket. If a file cannot be sent, or the save comes back refused, the files sent in that attempt are taken away again and the drawer stays open with the problem on the box or slot it belongs to. The server reads every new file back and checks it again, and removes the files no sponsor uses any more after the list is written (ADR-105).
- **The hero picture and the layout notes use the public site's own rules.** `heroViewOf` turns the drafts into the same `SponsorAd` shape the home page reads and asks `heroCoverage` (ADR-109), so the preview shows the banner visitors would get and `layoutWarningOf` says whether no sponsor, or some sponsors, cannot show in the chosen layout. The page puts these into the notes with ICU plural words.
- **Sponsor changes save at once; the Hero text and layout keep their Save changes bar.** They are two different settings (`sponsors` and `hero`), saved by two different actions, so one can never overwrite the other. (C2.)

## Wording to confirm

The wording of the connected page is listed in this ADR with part C2.

## Consequences

- No migration, package, gate, environment or server change. New files in `src/features/site-content`: `sponsor-draft.ts`, `sponsor-upload.ts`, `sponsor-storage.ts` and their tests, and one constant (`SPONSOR_IMAGE_BUCKET`, held equal to the public side's `SPONSOR_BUCKET` by a test, because browser code of a feature may not import another feature's index). Nothing is connected to a page yet, so nothing visitors or admins see changes.
- Rollback: delete these files, their tests, the constant and this ADR.
