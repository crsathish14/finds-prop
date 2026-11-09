import { projectTag, tagsAfterProjectChange } from "@/lib/cache-tags";
import type { ProjectDone } from "./project-service";
import {
  createMyProjectSchema,
  createProjectSchema,
  updateMyProjectSchema,
  updateProjectSchema,
} from "./schemas";

/**
 * How the project form's actions run, kept apart from the "use server" file so a test can build them (S7-T02). There
 * is one pair for the admin (a super admin) and one for a builder (the role and an active record, agents included),
 * because the two forms differ in what they may send; each is limited with the user's other project saves
 * (`project_save`, 60 an hour: a long editing session is well inside it, a stuck script is not). No idempotency key:
 * saving sets values, so a repeat changes nothing more, and a second "create" with the same address is refused by
 * the database (the address is unique). A project shows on its public pages once it is approved, so a save refreshes
 * its page and the lists, and the old address's page too when the address changed. The database audits projects, with
 * the admin or the builder as the actor, so there is no `audit` entry here.
 */
const refresh = (done: ProjectDone): string[] => [
  ...tagsAfterProjectChange(done.slug),
  ...(done.previousSlug ? [projectTag(done.previousSlug)] : []),
];

export const createProjectConfig = {
  name: "createProject",
  input: createProjectSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "project_save" as const },
  invalidate: refresh,
};

export const updateProjectConfig = {
  name: "updateProject",
  input: updateProjectSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "project_save" as const },
  invalidate: refresh,
};

export const createMyProjectConfig = {
  name: "createMyProject",
  input: createMyProjectSchema,
  auth: { role: "builder" as const },
  rateLimit: { scope: "project_save" as const },
  invalidate: refresh,
};

export const updateMyProjectConfig = {
  name: "updateMyProject",
  input: updateMyProjectSchema,
  auth: { role: "builder" as const },
  rateLimit: { scope: "project_save" as const },
  invalidate: refresh,
};
