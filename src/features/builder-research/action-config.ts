import {
  readBuilderPagesAgainSchema,
  readMyPagesAgainSchema,
  saveBuilderResearchPagesSchema,
  saveMyResearchPagesSchema,
} from "./schemas";

/**
 * How the "Pages for the AI assistant" actions run (AI search Phase 4), kept apart from the "use server" file so a
 * test can build them. The builder's two act on its own record, the admin's two on the builder named. Saving opens
 * up to four pages of the builder's website to check them, so it shares the builder's (or the admin's) edit limit.
 * Nothing public changes (the assistant reads the pages only when a buyer asks), so no cache tag is refreshed. Every
 * check is written to the research log by the server.
 */
export const saveMyResearchPagesConfig = {
  name: "saveMyResearchPages",
  input: saveMyResearchPagesSchema,
  auth: { role: "builder" as const },
  rateLimit: { scope: "builder_edit" as const },
};

export const readMyPagesAgainConfig = {
  name: "readMyPagesAgain",
  input: readMyPagesAgainSchema,
  auth: { role: "builder" as const },
  rateLimit: { scope: "builder_edit" as const },
};

export const saveBuilderResearchPagesConfig = {
  name: "saveBuilderResearchPages",
  input: saveBuilderResearchPagesSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_decision" as const },
};

export const readBuilderPagesAgainConfig = {
  name: "readBuilderPagesAgain",
  input: readBuilderPagesAgainSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_decision" as const },
};
