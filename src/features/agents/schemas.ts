import { z } from "zod";

/**
 * One agent as `public_agents()` returns it, checked as it comes in. A row that does not fit is skipped (and counted in the
 * log), so one odd row never takes the whole section down. The phone and the email are not part of it.
 */
export const agentRowSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1),
  tagline: z.string().nullable().catch(null),
  description: z.string().nullable().catch(null),
  logo_path: z.string().nullable().catch(null),
  logo_url: z.string().nullable().catch(null),
  established_year: z.number().int().nullable().catch(null),
  listing_count: z.number().int().nonnegative().catch(0),
  localities: z.array(z.string().min(1)).catch([]),
});

export type AgentRow = z.infer<typeof agentRowSchema>;

/** The input of the reveal action: the agent's id, a UUID, and nothing else (the caller is the session). */
export const revealContactSchema = z.object({ agentId: z.uuid() });

export type RevealContactInput = z.infer<typeof revealContactSchema>;
