# ADR-145 · Design Lab: screenshots are attached to the report, not compared with stored images

- Status: Accepted (owner's decision, 21 Nov 2026)
- Date: 2026-11-21
- Supersedes: the screenshot-comparison part of the H2-T02 decision (PR #36); the rest of G-10 (lab part) stays
- Related: R-TEST-02, R-TEST-06, ADR-127 (the font change that replaced every baseline)
- Class: C2 (a CI gate changes, and 105 stored test images are deleted, both by the owner's decision)

## Decision

- **The CI step `npm run test:ds` no longer compares screenshots.** `DESIGN_LAB_VISUAL: compare` is removed from `.github/workflows/ci.yml`, the comparison is removed from `captureScreenshot` in `e2e/design-lab/helpers.ts`, and the 105 stored images in `e2e/design-lab/boards.spec.ts-snapshots/` (8.7 MB) are deleted.
- **What still gates a pull request:** axe (no serious or critical violation), the sideways-scroll check and the keyboard tests, on every board and preview at 390, 820 and 1440 px. These are the checks that cannot be done by eye.
- **What is kept:** a full-page screenshot of every board and preview at each width is still attached to the Playwright report. The `playwright-report` artifact is now uploaded on every run, not only on a failure (kept 7 days), so the owner can look at the pictures of any run.
- **R-TEST-06 is reworded:** a screenshot is looked at by the owner against the UX render; nothing compares it with a stored image.

## Why

- Every visual change, and every new board or preview, failed CI until someone downloaded the failure artifact, copied the new pictures over the stored ones in their own commit and pushed again. Nearly every UI pull request paid this cost, and the pictures were reviewed by eye anyway.
- The stored images could only be made by the Linux runner, so nobody could update them on a developer machine.
- The tool's own rules forbid the shortcuts (raise the threshold, update the images in CI, skip a page), so a failing step could only be fixed by the manual cycle.

## Consequences you should know

- **An accidental visual change is no longer caught by a machine.** It is caught only when someone looks at the report pictures. The accessibility and sideways-scroll checks still catch the worst layout breaks.
- **The font change (ADR-127) and the like no longer produce 85 changed images.** A new board or preview needs no extra commit.
- **If a comparison is wanted again,** a manual workflow that regenerates the images on the runner and commits them to the pull request branch is the next option; it was considered and not chosen.
- **R-TEST-02 still holds for everything else:** no `.only`, no `.skip` without an issue and date, no deleted assertion without a stated reason. This ADR is that stated reason for the screenshot assertion.
