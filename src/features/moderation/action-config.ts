import { tagsAfterListingChange } from "@/lib/cache-tags";
import { loadMoreSchema, moderateListingSchema } from "./schemas";

/**
 * How the admin's decision runs, kept apart from the "use server" file so a test can build it (S6-T04).
 * Only a super admin may call it. Decisions are limited to 120 per admin per hour (`admin_decision`): a
 * busy morning of reviewing is well inside it, and a stuck script is not. No idempotency key: a second,
 * identical call finds the listing already decided and the database answers with a conflict, so nothing is
 * written twice. Every decision changes what the public pages show (an approved home appears, a rejected or
 * unfeatured one leaves the lists), so the tags of the lists and of that home's page are refreshed. The change
 * is recorded in the audit log by the database, with the admin as the actor, so there is no `audit` entry
 * here.
 */
export const moderateListingConfig = {
  name: "moderateListing",
  input: moderateListingSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_decision" as const },
  invalidate: (result: { shortId: string }) => tagsAfterListingChange(result.shortId),
};

/**
 * "Show more" on the queue (S6-T04): a read, so it changes nothing and has no cache tags, audit entry or
 * idempotency key. Only a super admin may call it, and the database checks that again. It has no rate limit of its
 * own: each call reads one page of 25 for a person who is already signed in as an admin.
 */
export const loadMoreListingsConfig = {
  name: "loadMoreListings",
  input: loadMoreSchema,
  auth: { role: "super_admin" as const },
};
