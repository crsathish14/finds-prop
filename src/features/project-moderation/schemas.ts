import { z } from "zod";
import { PROJECT_DECISIONS } from "./constants";

/**
 * What the admin's moderation actions take from the browser (S7-T04, FR-ADM-03). Nothing here says who is
 * deciding: the admin is the signed-in session (R-BE-03). A schema message is a key under `validation.*`; the screen
 * looks the words up (ADR-035).
 */
const projectId = z.uuid({ error: "validation.invalid" }).transform((value) => value.toLowerCase());

/** One decision on one project. The decision picks the rule; the database holds which state each one needs. */
export const moderateProjectSchema = z.object({
  projectId,
  decision: z.enum(PROJECT_DECISIONS, { error: "validation.invalid" }),
});
export type ModerateProjectInput = z.infer<typeof moderateProjectSchema>;

export const deleteProjectSchema = z.object({ projectId });
export type DeleteProjectInput = z.infer<typeof deleteProjectSchema>;
