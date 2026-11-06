import { readSavedInputSchema, savedHomeInputSchema } from "./schemas";

/**
 * How the saved-home actions run, kept apart from the "use server" file so a test can build them.
 * Saving needs a signed-in visitor with a verified phone (the same rule as sending a lead, and the
 * database's insert rule). There is no rate limit: a save is one row per visitor and home, so a
 * repeat changes nothing. Reading the visitor's own saved homes works for anyone, signed in or not.
 */
export const saveHomeConfig = {
  name: "saveHome",
  input: savedHomeInputSchema,
  auth: "verified-phone" as const,
};

export const unsaveHomeConfig = {
  name: "unsaveHome",
  input: savedHomeInputSchema,
  auth: "verified-phone" as const,
};

export const readSavedHomesConfig = {
  name: "readSavedHomes",
  input: readSavedInputSchema,
  auth: "none" as const,
};
