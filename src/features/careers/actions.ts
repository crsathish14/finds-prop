"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import {
  closeJobConfig,
  createJobConfig,
  openJobConfig,
  restoreJobConfig,
  trashJobConfig,
  unpublishJobConfig,
  updateJobConfig,
} from "./action-config";
import {
  closeJob,
  createJob,
  openJob,
  restoreJob,
  saveJob,
  trashJob,
  unpublishJob,
} from "./job-service";
import { createJobStore } from "./service";

// defineAction has already refused anyone who is not a super admin; the check below only keeps the type honest.
function assertSession(session: unknown): void {
  if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
}

/** Makes a draft job, as the signed-in super admin. Answers its id, address and status. */
export const createJobPosting = defineAction({
  ...createJobConfig,
  handler: async ({ input, session, log }) => {
    assertSession(session);
    const done = await createJob(await createJobStore(), input);
    log.info("job created", { jobId: done.jobId });
    return done;
  },
});

/** Saves the editor: the words, the department, the place, the way to apply and the closing date. */
export const updateJobPosting = defineAction({
  ...updateJobConfig,
  handler: async ({ input, session, log }) => {
    assertSession(session);
    const done = await saveJob(await createJobStore(), input);
    log.info("job saved", { jobId: done.jobId });
    return done;
  },
});

/** Puts a job on the site (or opens a closed one again). */
export const openJobPosting = defineAction({
  ...openJobConfig,
  handler: async ({ input, session, log }) => {
    assertSession(session);
    const done = await openJob(await createJobStore(), input);
    log.info("job opened", { jobId: done.jobId });
    return done;
  },
});

/** The Close posting button: takes a job off the site and keeps it as closed. */
export const closeJobPosting = defineAction({
  ...closeJobConfig,
  handler: async ({ input, session, log }) => {
    assertSession(session);
    const done = await closeJob(await createJobStore(), input);
    log.info("job closed", { jobId: done.jobId });
    return done;
  },
});

/** Takes a job off the site and back to a draft. */
export const unpublishJobPosting = defineAction({
  ...unpublishJobConfig,
  handler: async ({ input, session, log }) => {
    assertSession(session);
    const done = await unpublishJob(await createJobStore(), input);
    log.info("job unpublished", { jobId: done.jobId });
    return done;
  },
});

/** Moves a job to Trash (soft delete). */
export const trashJobPosting = defineAction({
  ...trashJobConfig,
  handler: async ({ input, session, log }) => {
    assertSession(session);
    const done = await trashJob(await createJobStore(), input);
    log.info("job trashed", { jobId: done.jobId });
    return done;
  },
});

/** Brings a job back from Trash. */
export const restoreJobPosting = defineAction({
  ...restoreJobConfig,
  handler: async ({ input, session, log }) => {
    assertSession(session);
    const done = await restoreJob(await createJobStore(), input);
    log.info("job restored", { jobId: done.jobId });
    return done;
  },
});
