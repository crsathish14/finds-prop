import type { SupabaseClient } from "@supabase/supabase-js";
import { checkPictureClean } from "@/lib/image-hidden-data";
import { ActionError } from "@/server/actions/normalise-error";
import type { Database } from "@/types/database.types";
import { mapBuilderError } from "./builder-service";
import { BUILDER_LOGO_BUCKET } from "./constants";
import type { UpdateMyProfileInput } from "./schemas";

/**
 * Saves the signed-in builder's own company profile (S7-T03, FR-BLD-05). It takes the builder's own client, so the
 * database decides: `my_builder()` returns only their record, and the update policy and column grant let them change
 * only the profile columns of it (not the email, the type or whether they are active). A box left empty clears an
 * optional field. The logo is the path of a picture the builder's browser has already put in their own folder of the
 * logo bucket (ADR-179); the old file is taken away by the browser after the save. Nothing is found for an account with no active builder record.
 */
export async function saveMyProfile(
  client: SupabaseClient<Database>,
  input: UpdateMyProfileInput,
): Promise<{ builderId: string }> {
  const mine = await client.rpc("my_builder").select("id");
  if (mine.error) throw mapBuilderError(mine.error);
  const builderId = mine.data[0]?.id;
  if (!builderId) throw new ActionError("NOT_FOUND", "The builder was not found");
  // A logo can only be one the builder uploaded into their own folder (the database checks it too).
  if (input.logoPath && !input.logoPath.startsWith(`${builderId}/`)) {
    throw new ActionError("VALIDATION", "The logo is not in this builder's folder", {
      fieldErrors: { logoPath: [{ key: "validation.invalid" }] },
    });
  }
  // A logo that is new is read back from the bucket: the browser takes its hidden data out before it sends it, so one
  // that still has some did not come through the page. The logo already on record is not read again.
  if (input.logoPath) {
    const current = await client.from("builders").select("logo_path").eq("id", builderId);
    if (current.error) throw mapBuilderError(current.error);
    if (current.data[0]?.logo_path !== input.logoPath) {
      await checkNewLogo(client, input.logoPath);
    }
  }
  const saved = await client
    .from("builders")
    .update({
      name: input.name,
      contact_person: input.contactPerson ?? null,
      phone: input.phone ?? null,
      logo_url: input.logoUrl ?? null,
      website: input.website ?? null,
      description: input.description ?? null,
      tagline: input.tagline ?? null,
      established_year: input.establishedYear ?? null,
      projects_delivered: input.projectsDelivered ?? null,
      logo_path: input.logoPath ?? null,
    })
    .eq("id", builderId)
    .select("id");
  if (saved.error) throw mapBuilderError(saved.error);
  if (saved.data.length === 0) throw new ActionError("NOT_FOUND", "The builder was not found");
  return { builderId };
}

/** Reads a new logo back from the logo bucket (the builder's own client may read its own folder) and checks it. */
async function checkNewLogo(client: SupabaseClient<Database>, path: string): Promise<void> {
  const file = await client.storage.from(BUILDER_LOGO_BUCKET).download(path);
  const refuse = (key: string) =>
    new ActionError("VALIDATION", "The logo could not be accepted", {
      fieldErrors: { logoPath: [{ key }] },
    });
  if (file.error || !file.data) throw refuse("validation.invalid");
  const clean = checkPictureClean(new Uint8Array(await file.data.arrayBuffer()));
  if (clean === "hidden") throw refuse("validation.logoHidden");
  if (clean === "broken") throw refuse("validation.invalid");
}
