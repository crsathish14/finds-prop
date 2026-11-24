import "server-only";
import { headers } from "next/headers";
import { getSiteSettings, getSponsorAds } from "@/features/site";
import { ActionError } from "@/server/actions/normalise-error";
import { env } from "@/server/env";
import { clientIp, visitorHash } from "@/server/rate-limit/visitor-hash";
import { createAdminSupabase } from "@/server/supabase/admin.server";
import type { LiveSponsors, SponsorEventStore } from "./event-service";

/**
 * The part of the sponsor report that writes (ADR-194): it reaches the database with the service role, because
 * nobody may write the counts directly (`record_sponsor_event` is the only way in, and execute is granted to the
 * service role alone). It is on the service-role allow-list (docs/engineering/security.md 4.3). The only caller is
 * the counting action built with `defineAction`, which has already counted the rate limit.
 */
export function createSponsorEventStore(requestId: string): SponsorEventStore {
  const client = createAdminSupabase(requestId);
  return {
    async record(row) {
      const { data, error } = await client.rpc("record_sponsor_event", {
        p_slot: row.slot,
        p_key: row.key,
        p_kind: row.kind,
        p_visitor_hash: row.visitor,
      });
      if (error || typeof data !== "boolean") {
        throw new ActionError("INTERNAL", "the sponsor event could not be recorded");
      }
      return data;
    },
  };
}

/** What is live now, from the cached site content: the active hero ads and the picked builders. */
export async function readLiveSponsors(): Promise<LiveSponsors> {
  const [ads, settings] = await Promise.all([getSponsorAds(), getSiteSettings()]);
  return {
    hero: new Set(ads.filter((ad) => ad.active).map((ad) => ad.id)),
    results: new Set(settings.sponsored_builders.featured),
    spotlight: new Set(settings.sponsored_builders.spotlight),
  };
}

/**
 * Who is calling, as the same one-way hash the rate limiter counts (BR-75): the address and browser mixed with a
 * server-only secret. The raw address is never stored.
 */
export async function currentVisitor(): Promise<string> {
  const incoming = await headers();
  return visitorHash(
    env.RATE_LIMIT_HMAC_SECRET,
    clientIp(incoming, env.APP_ENV !== "local"),
    incoming.get("user-agent") ?? "",
  );
}
