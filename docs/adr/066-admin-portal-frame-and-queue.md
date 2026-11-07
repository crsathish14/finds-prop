# ADR-066 · The admin portal frame and the connected listings queue (S6-T04, part 4)

- Status: Accepted
- Date: 2026-11-07
- Related: ADR-064 (database), ADR-065 (server side), ADR-020 (Design Lab), ADR-035 (message keys), FR-ADM-02
- Plan approved by the owner on 7 Nov 2026 ("as recommended"): all navigation groups with placeholders behind them, "Show more" without leaving the page, and the extra wording flagged for confirmation.

## Decision

- **One frame for every admin page.** `(portal)/admin/layout.tsx` keeps the role gate and puts `AdminFrame` inside it: the shared `PortalShell` with the approved navigation (Overview; Moderation: Listings, Projects; Inventory: Units, Builders; Leads and CRM: Leads, Forms, CRM; Site content: Header, Hero, Homepage, Footer), a top bar with the account menu and its Sign out (to `/admin/login`), and "View public site" at the foot of the sidebar. Only Listings is a finished page; the others keep their placeholders, which no longer draw a second `<main>` (`RoutePlaceholder framed`).
- **The pending count in the sidebar** comes from `getQueueCounts()` read in the frame, never cached; if the read fails it is logged and the sidebar shows no number, so one failed read cannot break every admin page. A decision refreshes the page, which re-reads the frame.
- **The current page is marked in the browser, after hydration**, with `useClientPathname` (moved to `src/lib` so the admin feature can use it without reaching into the site feature). The navigation is plain data (`nav.ts`), tested alone.
- **The queue page.** The address names the tab, locality and kind; invalid values fall back to the defaults. The server page reads the first page, the counts and the localities together; one client island (`ListingsBoard`) holds the drawer, the reject dialog and the decisions. Approve, feature and remove from featured act at once and say so in a toast; reject always asks its reason in the same dialog. After a decision the page is read again, and until then the decided row is shown as the decision left it (or leaves the tab it was on).
- **Show more** is a new read action, `loadMoreListings` (super admin only, no limit, no cache tags, no audit: it changes nothing). It refuses a missing or foreign cursor instead of quietly returning the first page. The island keeps the rows it loaded and never draws a row twice when the first page is read again.
- **Failures:** a conflict (another admin decided first) says so and re-reads the page; a missing reason shows on the reason box; everything else uses the shared error words, including how long to wait after a rate limit.
- **Approved rows have a Review button too** (the approved UX shows only Feature or Remove from featured there). Without it an approved listing could not be opened to be read again. Rejected and closed rows have Review only.
- **Not in this change:** a search box (the UX has one; the queue function has no text search), other admin pages, the owner-facing "Not approved" view (S6-T03).

## Wording to confirm

New strings in `admin.*` in `en.json`. Most come from the approved UX file. These do not, and need the owner's confirmation:

- Table and rows: "Show more listings", "Showing {shown}" (when filters are on), "More listings could not be loaded. Please try again.", "Untitled listing", "No name given", "Not provided", "{date}, {time}", "Reason: {reason}", "For sale" and "For rent" as filter options.
- Empty tabs: "No approved listings yet", "No rejected listings", "No sold or rented listings", "No listings yet" and their lines, "No listings match these filters" and "Try another locality or type."
- Drawer: "Photos ({count})", "This listing has no photos", "Photo {number} of {count}", "Bathrooms", "Property type", "Address", "Reason it was not approved", "Unfurnished", "Semi-furnished", "Fully furnished", "{count} BHK".
- Reject dialog: the description (the UX's own line, plus "with the reason you give"), "Reason for the owner", "The owner reads this, so say what to fix.", "{count} / {max}", "Tell the owner what to fix.", "Use at most {max} characters."
- Toasts and errors: "Listing rejected" with "The owner will see your reason.", "Listing featured" with "It is marked as featured on Find Prop.", "Removed from featured" with "It stays live on Find Prop.", and "Someone has already decided this listing. The list has been refreshed."

## Consequences

- No migration, package or gate change. A new read action, a new feature module `admin`, and a move of one hook.
- The Design Lab parts are those of part 3; this change adds no pictures.
- Rollback: restore the previous layout and `listings/page.tsx`, delete `src/features/admin`, the board files and the new messages. Nothing is destroyed.
