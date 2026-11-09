import type { SupabaseClient } from "@supabase/supabase-js";
import { ActionError } from "@/server/actions/normalise-error";
import type { Database } from "@/types/database.types";
import { mapBuilderError } from "./builder-service";
import type { UpdateMyProfileInput } from "./schemas";

/**
 * Saves the signed-in builder's own company profile (S7-T03, FR-BLD-05). It takes the builder's own client, so the
 * database decides: `my_builder()` returns only their record, and the update policy and column grant let them change
 * only the profile columns of it (not the email, the type or whether they are active). A box left empty clears an
 * optional field. Nothing is found for an account with no active builder record.
 */
export async function saveMyProfile(
  client: SupabaseClient<Database>,
  input: UpdateMyProfileInput,
): Promise<{ builderId: string }> {
  const mine = await client.rpc("my_builder").select("id");
  if (mine.error) throw mapBuilderError(mine.error);
  const builderId = mine.data[0]?.id;
  if (!builderId) throw new ActionError("NOT_FOUND", "The builder was not found");
  const saved = await client
    .from("builders")
    .update({
      name: input.name,
      contact_person: input.contactPerson ?? null,
      phone: input.phone ?? null,
      logo_url: input.logoUrl ?? null,
      website: input.website ?? null,
      description: input.description ?? null,
    })
    .eq("id", builderId)
    .select("id");
  if (saved.error) throw mapBuilderError(saved.error);
  if (saved.data.length === 0) throw new ActionError("NOT_FOUND", "The builder was not found");
  return { builderId };
}
