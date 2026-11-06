import { z } from "zod";
import { isShortId } from "@/lib/short-id";

/** The public id of a home (its short id, as in the address). One schema for the client and the server. */
export const savedHomeInputSchema = z.object({
  shortId: z.string().refine(isShortId, "validation.invalid"),
});

export type SavedHomeInput = z.infer<typeof savedHomeInputSchema>;

/** Reading the visitor's saved homes takes no input. */
export const readSavedInputSchema = z.object({});

export type ReadSavedInput = z.infer<typeof readSavedInputSchema>;
