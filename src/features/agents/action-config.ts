import { revealContactSchema } from "./schemas";

/**
 * How the reveal action runs, kept apart from the "use server" file so a test can build it. Showing an agent's phone
 * needs a signed-in visitor with a verified phone (the same rule as an enquiry: the owner asks a person to be reachable
 * before showing them another's number), and it is limited to 30 a day per user so the numbers cannot be collected in bulk.
 * No key and nothing is written: asking twice only shows the number twice.
 */
export const revealContactConfig = {
  name: "revealAgentContact",
  input: revealContactSchema,
  auth: "verified-phone" as const,
  rateLimit: { scope: "contact_reveal" as const },
};
