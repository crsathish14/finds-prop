import "server-only";
import type { Database } from "@/types/database.types";
import { createAdminSupabase } from "../supabase/admin.server";

type GuestSearchArgs = Database["public"]["Functions"]["guest_search_properties"]["Args"];

/** The most homes one guest search gives, however many the caller asks for (the database holds the same cap). */
export const GUEST_HOMES_MAX = 10;

/**
 * The homes the assistant may show a guest: a visitor who is not signed in, inside the 2-chat guest limit (ADR-171, owner
 * decision of 23 Nov 2026). It uses the service-role client, so it is allow-listed on its own (R-BE-07) and used for this
 * one call only. It calls `guest_search_properties()`, which only the service role may run, so a browser holding the
 * public key cannot reach it around the endpoint's rate limits. It gives the search's own public card columns, at most
 * ten homes at a time, and nothing about projects. Its caller is the chat endpoint's search tool, which runs only after the
 * endpoint's limits have passed; nothing here takes the id of a person.
 */
export async function guestSearchHomes(args: GuestSearchArgs) {
  const limit = Math.min(Math.max(args.p_limit ?? GUEST_HOMES_MAX, 1), GUEST_HOMES_MAX);
  return createAdminSupabase().rpc("guest_search_properties", { ...args, p_limit: limit });
}
