import "server-only";
import { connection } from "next/server";
import { z } from "zod";
import { SPONSOR_EVENT_SLOTS } from "@/lib/sponsor-events";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import { reportRange, type ReportCount } from "./report";

const countSchema = z.object({
  slot: z.enum(SPONSOR_EVENT_SLOTS),
  sponsor_key: z.string(),
  views: z.coerce.number(),
  clicks: z.coerce.number(),
});

/**
 * The totals of each paid placement over the last `days` days (India time), read as the signed-in super admin
 * through `admin_sponsor_report()`, which refuses anyone else. Never cached: the admin sees today's counts. A failed
 * read is logged by its code and thrown, so the page shows its error state instead of a report of zeros.
 */
export async function getSponsorCounts(
  days: number,
): Promise<{ counts: ReportCount[]; from: string; to: string }> {
  await connection();
  const { from, to } = reportRange(days, new Date());
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_sponsor_report", { p_from: from, p_to: to });
  if (error) {
    logger.error("the sponsor report could not be read", { errorCode: error.code });
    throw error;
  }
  const counts = (Array.isArray(data) ? data : []).flatMap((row) => {
    const parsed = countSchema.safeParse(row);
    return parsed.success
      ? [
          {
            slot: parsed.data.slot,
            key: parsed.data.sponsor_key,
            views: parsed.data.views,
            clicks: parsed.data.clicks,
          },
        ]
      : [];
  });
  return { counts, from, to };
}
