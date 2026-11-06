import "server-only";
import { z } from "zod";
import { getAccountSummary } from "@/features/auth";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import type { SentEnquiry } from "./view";

/** How many sent enquiries the dashboard reads; the newest first. */
export const SENT_LIMIT = 60;

/** What the enquiry form starts with: the account's own details. The visitor can change any of them. */
export interface EnquiryContact {
  name: string;
  /** The sign-in number as digits (`919840012345`), or empty when the token has none. */
  phone: string;
  /** The verified email, or empty. */
  email: string;
}

/**
 * The signed-in visitor's name, phone and verified email, for the enquiry form to start with. The phone
 * is read from the verified token (`getClaims`), never from the browser. A read that fails gives empty
 * fields, so the form is still usable (the visitor types them).
 */
export async function getEnquiryContact(userId: string): Promise<EnquiryContact> {
  const supabase = await createServerSupabase();
  const [summary, claims] = await Promise.all([
    getAccountSummary(userId),
    supabase.auth.getClaims(),
  ]);
  const phone = claims.data?.claims.phone;
  const digits = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
  return {
    name: summary.fullName ?? "",
    phone: /^[0-9]{6,15}$/.test(digits) ? digits : "",
    email: summary.email ?? "",
  };
}

const sentRowSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  status: z.enum(["new", "contacted", "closed"]),
  message: z.string().nullable(),
  properties: z
    .object({ short_id: z.string(), slug: z.string(), title: z.string().nullable() })
    .nullable(),
});

/**
 * The enquiries the signed-in visitor sent, newest first. The read is as the visitor and also asks for
 * their own rows by name: the database lets an owner see the enquiries on their own homes too, and those
 * are not "sent" by them. The home comes along when the visitor can still see it; a home that was sold,
 * rented or withdrawn gives none, and the row keeps its time, status and message. A failed read throws,
 * so the account's error page shows it.
 */
export async function getSentEnquiries(
  userId: string,
): Promise<{ enquiries: SentEnquiry[]; now: number }> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("enquiries")
    .select("id, created_at, status, message, properties(short_id, slug, title)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(SENT_LIMIT);
  if (error) {
    logger.error("sent enquiries could not be read", { errorCode: error.code });
    throw error;
  }
  const rows: SentEnquiry[] = [];
  for (const row of data ?? []) {
    const parsed = sentRowSchema.safeParse(row);
    if (!parsed.success) continue;
    const home = parsed.data.properties;
    rows.push({
      id: parsed.data.id,
      sentAt: parsed.data.created_at,
      status: parsed.data.status,
      message: parsed.data.message,
      home:
        home && home.title
          ? { href: `/properties/${home.slug}-${home.short_id}`, title: home.title }
          : null,
    });
  }
  // The time is taken here, in the read, so the list says "2 hours ago" as of this request.
  return { enquiries: rows, now: Date.now() };
}
