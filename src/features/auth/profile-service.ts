import { ActionError } from "@/server/actions/normalise-error";
import type { SaveProfileNameInput } from "./schemas";

export interface ProfileNameDeps {
  /** Updates the name on one profile row through the signed-in user's own session; says how many rows changed. */
  updateName(userId: string, fullName: string): Promise<{ error: unknown; updated: number }>;
}

/**
 * Saves the name on the user's own profile. A database error is thrown as it is, so the one error
 * mapper turns it into a safe code (R-BE-05). No row changed means the profile is missing, which
 * for a signed-in user should not happen: it is reported as not found, never as a success.
 */
export async function updateProfileName(
  deps: ProfileNameDeps,
  userId: string,
  input: SaveProfileNameInput,
): Promise<{ name: string }> {
  const { error, updated } = await deps.updateName(userId, input.name);
  if (error) throw error;
  if (updated === 0) throw new ActionError("NOT_FOUND", "No profile row was updated");
  return { name: input.name };
}
