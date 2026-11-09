# ADR-092 · The builder portal: the frame (S7-T03, step A)

- Status: Accepted
- Date: 2026-11-09
- Related: ADR-091 (the project form's pages), S6-T04 (the admin's frame), FR-BLD-01, FR-BLD-02
- Plan for S7-T03 approved by the owner on 9 Nov 2026: five steps (A the frame, B projects, C units and leads, D profile, E dashboard and insights), no charts until the chart spike, the open decisions on their defaults (a new `builder_edit` rate limit scope in step C, no sidebar badge, no new Design Lab picture round).

## Decision

- **Every builder page sits in a portal frame:** the sidebar, the top bar with the account menu and Sign out, and the page. The builder layout puts the frame inside the role gate (`PageGate area="builder"`), so a visitor or a non-builder never sees it. The routes are still placeholders; the pages come in steps B to E.
- **One shell for both portals.** The builder's frame is the admin's shell (`AdminShell`, now exported from the admin feature) given the builder's navigation, so the two portals cannot drift apart. The shell gains two icons (Insights, Profile). A new `builder-portal` feature holds the builder's navigation (`buildBuilderNav`) and frame (`BuilderFrame`).
- **The navigation is the approved builder list, in one group with no heading:** Dashboard, Projects, Units, Leads, Insights, Profile (the UX file's shell). A project's pages (`/builder/projects/new`, `/builder/projects/<id>`) mark Projects as the current link. There is no count beside any link (the admin's Listings number needs its own read; the builder's Projects badge is left out at first).
- **The top bar** shows the account menu with the role "Builder" and no extra groups, and Sign out goes back to the builder sign-in (`/builder/login`). The link under the list is "View public site".
- **Not in this change:** the pages themselves (steps B to E), a sidebar number, and any Design Lab entry (the shell is unchanged; its unit test now also covers the builder's list).

## Wording to confirm

- The shell's words for the builder: "Builder" (the navigation's name and the portal tag), "Builder menu" (the title of the phone menu); "Open menu", "Close menu" and "View public site" are the admin's own words.
- The six link names are the UX file's.

## Consequences

- One layout change, a small feature and a shell icon change; no server, database, package, gate or environment change.
- Every builder route now shows the sidebar around its placeholder.
- Rollback: restore the builder layout to the gate alone and delete the `builder-portal` feature and the `builderPortal` words.
