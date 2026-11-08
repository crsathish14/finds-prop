import "server-only";
import { z } from "zod";
import { getAccountSummary } from "@/features/auth";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import type { ReceivedEnquiry, SentEnquiry } from "./view";

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

/** How many received enquiries the dashboard reads; the newest first. */
export const RECEIVED_LIMIT = 60;

/** The most listings whose enquiries are read at once (an owner has far fewer). */
const OWN_LISTINGS_LIMIT = 200;

const receivedRowSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  status: z.enum(["new", "contacted", "closed"]),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  message: z.string().nullable(),
  properties: z
    .object({
      short_id: z.string(),
      slug: z.string(),
      title: z.string().nullable(),
      status: z.string(),
    })
    .nullable(),
});

/**
 * The enquiries other people sent about the signed-in owner's own listings, newest first (S6-T03, FR-ACC-04).
 * The read is as the owner: the database lets them see an enquiry when it is about a listing they own, and
 * also when they sent it themselves, so the owner's own listings are asked for first (`my_properties()`
 * returns only theirs) and only those are read. A failed read throws, so the account's error page shows it.
 */
export async function getReceivedEnquiries(): Promise<{
  enquiries: ReceivedEnquiry[];
  now: number;
}> {
  const supabase = await createServerSupabase();
  const own = await supabase
    .rpc("my_properties")
    .select("id")
    .neq("status", "draft")
    .limit(OWN_LISTINGS_LIMIT);
  if (own.error) {
    logger.error("the owner's listings could not be read for their enquiries", {
      errorCode: own.error.code,
    });
    throw own.error;
  }
  const ids = own.data.map((row) => row.id);
  if (ids.length === 0) return { enquiries: [], now: Date.now() };

  const { data, error } = await supabase
    .from("enquiries")
    .select(
      "id, created_at, status, name, phone, email, message, properties(short_id, slug, title, status)",
    )
    .in("property_id", ids)
    .order("created_at", { ascending: false })
    .limit(RECEIVED_LIMIT);
  if (error) {
    logger.error("received enquiries could not be read", { errorCode: error.code });
    throw error;
  }
  const rows: ReceivedEnquiry[] = [];
  for (const row of data ?? []) {
    const parsed = receivedRowSchema.safeParse(row);
    if (!parsed.success) continue;
    const home = parsed.data.properties;
    rows.push({
      id: parsed.data.id,
      receivedAt: parsed.data.created_at,
      status: parsed.data.status,
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
      message: parsed.data.message,
      home: home
        ? {
            title: home.title,
            href: home.status === "approved" ? `/properties/${home.slug}-${home.short_id}` : null,
          }
        : null,
    });
  }
  // The time is taken here, in the read, so the list says "2 hours ago" as of this request.
  return { enquiries: rows, now: Date.now() };
}

/** How many enquiries the signed-in owner has received, and how many of them nobody has moved yet. */
export interface ReceivedCounts {
  total: number;
  fresh: number;
}

/**
 * The numbers on the Enquiries received tab (S6-T03): all received and the New ones, counted by the database
 * for the owner's own listings (read the same way as the list). An owner with no listings has none. A failed
 * read throws, so the account's error page shows it.
 */
export async function countReceivedEnquiries(): Promise<ReceivedCounts> {
  const supabase = await createServerSupabase();
  const own = await supabase
    .rpc("my_properties")
    .select("id")
    .neq("status", "draft")
    .limit(OWN_LISTINGS_LIMIT);
  if (own.error) {
    logger.error("the owner's listings could not be read to count their enquiries", {
      errorCode: own.error.code,
    });
    throw own.error;
  }
  const ids = own.data.map((row) => row.id);
  if (ids.length === 0) return { total: 0, fresh: 0 };
  const [all, fresh] = await Promise.all([
    supabase.from("enquiries").select("id", { count: "exact", head: true }).in("property_id", ids),
    supabase
      .from("enquiries")
      .select("id", { count: "exact", head: true })
      .in("property_id", ids)
      .eq("status", "new"),
  ]);
  const failure = all.error ?? fresh.error;
  if (failure) {
    logger.error("received enquiries could not be counted", { errorCode: failure.code });
    throw failure;
  }
  return { total: all.count ?? 0, fresh: fresh.count ?? 0 };
}

/**
 * How many enquiries the visitor sent (the number on the My enquiries tab), asked for by their own id like the
 * list is. A failed read throws, so the account's error page shows it.
 */
export async function countSentEnquiries(userId: string): Promise<number> {
  const supabase = await createServerSupabase();
  const { count, error } = await supabase
    .from("enquiries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) {
    logger.error("sent enquiries could not be counted", { errorCode: error.code });
    throw error;
  }
  return count ?? 0;
}
