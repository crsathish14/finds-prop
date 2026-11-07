# ADR-064 · Listing moderation: the admin's queue and decisions in the database (S6-T04, part 1)

- Status: Accepted
- Date: 2026-11-07
- Related: ADR-024 (listing lifecycle, policy C), ADR-017 (public projections), ADR-028 (audit log), ADR-060 (listing submit), plan 06 section 6.2, FR-ADM-02, BR-23 to BR-25, DEC-09, P2 and P23 in the design handoff
- Plan approved by the owner on 7 Nov 2026, "all recommended": 25 rows a page with "Show more", the owner's name and email in the table and the address only in the review drawer, approve / reject / feature / remove from featured and nothing more, one dialog for the reject confirmation and its reason, the other admin pages left as placeholders.

## Decision

- **`moderate_listing(listing, action, reason)` is the only way a listing is approved, rejected or featured.** It is a definer function; each call checks that the caller is a super admin itself, so a mistake in a grant cannot open it. The lifecycle guard already treats a definer function as the system, so clients still cannot write `status`, `featured` or the moderation columns. Actions: `approve` and `reject` need a pending listing (a rejected listing returns to the queue only when its owner resubmits, S6-T05), `reject` needs a reason of 1 to 500 characters after trimming, `feature` needs an approved listing that is not featured, `unfeature` needs a featured one. A wrong state is `listing.not_reviewable` or `listing.not_featurable` (55000), so two admins acting on the same row get a clear refusal instead of a silent second write. It returns the short id, status and featured flag, which is what the page needs to refresh the cache tags.
- **The audit entry also keeps the rejection reason.** The row loses the reason when the owner resubmits (the guard clears it), so `audit_properties` now adds it to the `listing.status_changed` entry when the new status is rejected. The actor is the admin, recorded by the existing trigger.
- **The queue is three read functions, super admin only.** `admin_listing_queue` returns one page, newest submission first, with the complete listing, its photos in order, and the owner's name and email, so opening the review drawer needs no second read. Paging is by the last row seen (submission time and id), not by offset, so a decision made meanwhile cannot skip or repeat a row. `admin_listing_counts` gives the tab and sidebar numbers; `admin_listing_localities` gives the filter's options. Drafts never appear: they are the owner's own. The owner's email is read from the auth table inside the definer function; no column grant is widened and nothing about the owner reaches an anonymous or ordinary signed-in reader.
- **Not in this change:** the server action and the screens (next pull requests), the owner-facing "Not approved" display and reason (S6-T03), editing and resubmitting (S6-T05), taking an approved listing down from the queue (not asked for), the other admin pages (Stage 7).

## Consequences

- No new package, table, grant or policy; four new functions, one function replaced (`audit_properties`, one extra key in the entry).
- The page that calls these runs with the admin's own session, not the service role.
- Rollback: drop the four functions and restore the previous `audit_properties`. Nothing is destroyed.
