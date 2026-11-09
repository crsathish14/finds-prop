"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import {
  createMyProjectConfig,
  createProjectConfig,
  updateMyProjectConfig,
  updateProjectConfig,
} from "./action-config";
import { addProject, saveProject } from "./project-service";
import { createProjectStore } from "./service";

/** Adds a project for a builder, as the signed-in super admin. It starts in review; media and price trends come after the first save. */
export const createProject = defineAction({
  ...createProjectConfig,
  handler: async ({ input, session, log }) => {
    // defineAction has already refused anyone who is not a super admin; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await addProject(await createProjectStore("admin"), input);
    log.info("project added by the admin", {
      projectId: done.projectId,
      builderId: input.builderId,
    });
    return done;
  },
});

/** Saves a project, as the signed-in super admin: its boxes, media, enquiry form and price trends. An admin's save needs no new approval. */
export const updateProject = defineAction({
  ...updateProjectConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveProject(await createProjectStore("admin"), input);
    log.info("project saved by the admin", { projectId: done.projectId });
    return done;
  },
});

/** Adds a project of the signed-in builder's own (agents included). It starts in review. */
export const createMyProject = defineAction({
  ...createMyProjectConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await addProject(await createProjectStore("builder"), input);
    log.info("project added by a builder", { projectId: done.projectId });
    return done;
  },
});

/**
 * Saves one of the signed-in builder's own projects. A change sends the project back to review and hides it until it
 * is approved again (BR-41); the answer says where it stands now.
 */
export const updateMyProject = defineAction({
  ...updateMyProjectConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveProject(await createProjectStore("builder"), input);
    log.info("project saved by a builder", {
      projectId: done.projectId,
      moderation: done.moderation,
    });
    return done;
  },
});
