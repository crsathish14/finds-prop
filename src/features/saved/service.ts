import { ActionError } from "@/server/actions/normalise-error";

/**
 * What the saving rules need from the database, as the signed-in visitor. The rules are here; the
 * store (store.ts) is the only thing that talks to Supabase, so the rules can be tested with a fake.
 */
export interface SavedStore {
  /** The id of a home the visitor may see, or null (not public, or no such home). */
  findVisibleHome(shortId: string): Promise<string | null>;
  /** Adds one saved row for the visitor. Throws the database error when the row already exists. */
  insertSaved(propertyId: string): Promise<void>;
  /** Removes the visitor's saved row for a home, if there is one. */
  deleteSaved(propertyId: string): Promise<void>;
}

/** Postgres's unique-violation code: the visitor already saved this home. */
const UNIQUE_VIOLATION = "23505";

function alreadySaved(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === UNIQUE_VIOLATION
  );
}

/**
 * Saves a home for the visitor. Saving twice is the same as saving once (the table keeps one row per
 * visitor and home), so a double tap or a retry changes nothing. A home the visitor cannot see is
 * "not found", whatever the reason, so nobody can learn about a home that is not listed.
 */
export async function saveHome(store: SavedStore, shortId: string): Promise<{ saved: true }> {
  const propertyId = await store.findVisibleHome(shortId);
  if (propertyId === null) throw new ActionError("NOT_FOUND", "No visible home has this id");
  try {
    await store.insertSaved(propertyId);
  } catch (error) {
    if (!alreadySaved(error)) throw error;
  }
  return { saved: true };
}

/**
 * Removes a home from the visitor's saved homes. Removing a home that is not saved, or that the
 * visitor can no longer see, changes nothing and is not an error.
 */
export async function unsaveHome(store: SavedStore, shortId: string): Promise<{ saved: false }> {
  const propertyId = await store.findVisibleHome(shortId);
  if (propertyId !== null) await store.deleteSaved(propertyId);
  return { saved: false };
}
