"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import {
  saveFooterConfig,
  saveHeaderConfig,
  saveHeroConfig,
  saveHomepageConfig,
} from "./action-config";
import {
  saveFooterContent,
  saveHeaderContent,
  saveHeroContent,
  saveHomepageContent,
} from "./content-service";
import { createContentStore } from "./service";

/** Saves the header: the site name, the links and the button. Shown on every public page at once. */
export const saveHeader = defineAction({
  ...saveHeaderConfig,
  handler: async ({ input, session, log }) => {
    // defineAction has already refused anyone who is not a super admin; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveHeaderContent(await createContentStore(), input);
    log.info("site content saved", { setting: done.key });
    return done;
  },
});

/** Saves the hero: the words and the layout (Search Desk or Split). */
export const saveHero = defineAction({
  ...saveHeroConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveHeroContent(await createContentStore(), input);
    log.info("site content saved", { setting: done.key });
    return done;
  },
});

/** Saves the homepage switches and the curated localities (which also feed the Popular chips). */
export const saveHomepage = defineAction({
  ...saveHomepageConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveHomepageContent(await createContentStore(), input);
    log.info("site content saved", { setting: done.key });
    return done;
  },
});

/** Saves the footer: the about text, the contact details, the links and the copyright line. */
export const saveFooter = defineAction({
  ...saveFooterConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveFooterContent(await createContentStore(), input);
    log.info("site content saved", { setting: done.key });
    return done;
  },
});
