"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { createServerSupabase } from "@/server/supabase/server";
import {
  readBuilderPagesAgainConfig,
  readMyPagesAgainConfig,
  saveBuilderResearchPagesConfig,
  saveMyResearchPagesConfig,
} from "./action-config";
import {
  forgetSavedCopies,
  myBuilderId,
  saveResearchPages,
  type PageChecker,
} from "./panel-service";
import { checkBuilderPage } from "./research.server";

const CHECKER: PageChecker = { check: (input) => checkBuilderPage(input) };

/** Saves the signed-in builder's pages for the AI assistant, each checked first. */
export const saveMyResearchPages = defineAction({
  ...saveMyResearchPagesConfig,
  handler: async ({ input, session, log }) => {
    // defineAction has already refused anyone who is not a builder; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const client = await createServerSupabase();
    const done = await saveResearchPages(client, CHECKER, {
      builderId: await myBuilderId(client),
      links: input.links,
    });
    log.info("builder research pages saved", {
      builderId: done.builderId,
      pages: input.links.length,
    });
    return done;
  },
});

/** "Read again" for the signed-in builder: forgets the saved copies of its pages. */
export const readMyPagesAgain = defineAction({
  ...readMyPagesAgainConfig,
  handler: async ({ session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const client = await createServerSupabase();
    const builderId = await myBuilderId(client);
    await forgetSavedCopies(client, builderId);
    log.info("builder research copies cleared", { builderId });
    return { builderId };
  },
});

/** The admin saves a builder's pages for the AI assistant, each checked first. */
export const saveBuilderResearchPages = defineAction({
  ...saveBuilderResearchPagesConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveResearchPages(await createServerSupabase(), CHECKER, input);
    log.info("builder research pages saved", {
      builderId: done.builderId,
      pages: input.links.length,
    });
    return done;
  },
});

/** "Read again" by the admin for one builder. */
export const readBuilderPagesAgain = defineAction({
  ...readBuilderPagesAgainConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    await forgetSavedCopies(await createServerSupabase(), input.builderId);
    log.info("builder research copies cleared", { builderId: input.builderId });
    return { builderId: input.builderId };
  },
});
