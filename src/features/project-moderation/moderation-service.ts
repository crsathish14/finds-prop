import { ActionError } from "@/server/actions/normalise-error";
import type { ProjectDecision } from "./constants";
import type { DeleteProjectInput, ModerateProjectInput } from "./schemas";

/**
 * The rules of the admin's project moderation (S7-T04, FR-ADM-03), apart from the code that reaches the database so
 * they can be tested with a stand-in. The real store is in `service.ts` and acts as the signed-in admin through their
 * own session: nothing here uses the service role. The database holds the rules that must not be walked around (who
 * may decide, which state each decision needs, a project with leads is not deleted; ADR-100); this file turns what it
 * answers into the closed set of action errors.
 */

/** What `moderate_project` answers: the project as it is after the decision. */
export interface ProjectDecided {
  projectId: string;
  slug: string;
  moderation: string;
  published: boolean;
  featured: boolean;
}

/** What a delete answers: which project went. */
export interface ProjectRemoved {
  projectId: string;
  slug: string;
}

/** Calls made as the signed-in admin. */
export interface ProjectModerationStore {
  /** Calls `moderate_project`. Throws the database's failure through `mapModerationError`. */
  decide(projectId: string, decision: ProjectDecision): Promise<ProjectDecided>;
  /** Deletes the project. Throws the database's failure through `mapModerationError`. */
  remove(projectId: string): Promise<ProjectRemoved>;
}

/** What the database says when a call fails. */
export interface DatabaseFailure {
  code?: string | undefined;
  message?: string | undefined;
}

/**
 * Turns what the database raises into the closed set of action errors. A project that is not in the state the
 * decision needs (another admin decided first, or the page is out of date) is a conflict the page can explain; so is
 * a delete refused because the project has leads (BR-44).
 */
export function mapModerationError(failure: DatabaseFailure): ActionError {
  const { code, message } = failure;
  if (message === "project.not_found" || code === "P0002") {
    return new ActionError("NOT_FOUND", "The project was not found");
  }
  if (
    message === "project.not_reviewable" ||
    message === "project.not_publishable" ||
    message === "project.not_featurable" ||
    code === "55000"
  ) {
    return new ActionError("CONFLICT", "The project is not in a state this decision needs");
  }
  if (code === "23503") {
    return new ActionError("CONFLICT", "The project has leads, so it cannot be deleted");
  }
  if (message === "project.not_allowed" || code === "42501") {
    return new ActionError("FORBIDDEN", "You don't have permission to do that.");
  }
  if (message === "project.bad_action" || code === "22023") {
    return new ActionError("VALIDATION", "The decision is not one of the known ones", {
      fieldErrors: { decision: [{ key: "validation.invalid" }] },
    });
  }
  return new ActionError("INTERNAL", "The decision could not be saved");
}

/** Makes one decision. The database refuses a wrong state. */
export function applyDecision(
  store: ProjectModerationStore,
  input: ModerateProjectInput,
): Promise<ProjectDecided> {
  return store.decide(input.projectId, input.decision);
}

/** Deletes a project. The database refuses it while the project has leads. */
export function removeProject(
  store: ProjectModerationStore,
  input: DeleteProjectInput,
): Promise<ProjectRemoved> {
  return store.remove(input.projectId);
}
