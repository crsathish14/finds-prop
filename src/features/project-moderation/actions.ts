"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { deleteProjectConfig, moderateProjectConfig } from "./action-config";
import { applyDecision, removeProject } from "./moderation-service";
import { createProjectModerationStore } from "./service";

/**
 * Approves, rejects, publishes, unpublishes, features or removes from featured one project, as the signed-in super
 * admin. Answers the project's id, address, state, published and featured flags, which is what the page needs to
 * update its row.
 */
export const moderateProject = defineAction({
  ...moderateProjectConfig,
  handler: async ({ input, session, log }) => {
    // defineAction has already refused anyone who is not a super admin; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await applyDecision(await createProjectModerationStore(), input);
    log.info("project decided", {
      projectId: done.projectId,
      decision: input.decision,
      moderation: done.moderation,
    });
    return done;
  },
});

/** Deletes one project, as the signed-in super admin. A project that has leads is refused (BR-44). */
export const deleteProject = defineAction({
  ...deleteProjectConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await removeProject(await createProjectModerationStore(), input);
    log.info("project deleted", { projectId: done.projectId });
    return done;
  },
});
