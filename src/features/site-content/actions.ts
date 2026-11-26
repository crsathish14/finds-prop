"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import {
  saveContentModulesConfig,
  saveDisclaimersConfig,
  saveFooterConfig,
  saveHeaderConfig,
  saveHeroConfig,
  saveHomepageConfig,
  saveProjectFieldsConfig,
  saveProjectPrimeConfig,
  saveSponsorsConfig,
  saveSponsoredBuildersConfig,
  saveTopDevelopersConfig,
} from "./action-config";
import {
  saveContentModulesContent,
  saveDisclaimersContent,
  saveFooterContent,
  saveHeaderContent,
  saveHeroContent,
  saveHomepageContent,
  saveProjectFieldsContent,
  saveProjectPrimeContent,
  saveSponsoredBuildersContent,
  saveTopDevelopersContent,
} from "./content-service";
import { createContentStore } from "./service";
import { saveSponsorsContent } from "./sponsor-service";
import { createSponsorStore } from "./sponsors.server";

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

/** Saves the sponsors: the whole list in its order, each picture checked against its stored file. */
export const saveSponsors = defineAction({
  ...saveSponsorsConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveSponsorsContent(await createSponsorStore(), input, log);
    log.info("sponsors saved", { count: done.count, active: done.active });
    return done;
  },
});

/** Switches the Blog, FAQ and Careers modules on or off from the admin dashboard (ADR-143). */
export const saveContentModules = defineAction({
  ...saveContentModulesConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveContentModulesContent(await createContentStore(), input);
    log.info("site content saved", { setting: done.key });
    return done;
  },
});

/** Saves the disclaimers shown in the footer and on the AI search page (ADR-152). */
export const saveDisclaimers = defineAction({
  ...saveDisclaimersConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveDisclaimersContent(await createContentStore(), input);
    log.info("site content saved", { setting: done.key });
    return done;
  },
});

/** Saves the extra boxes of the builder's project form (ADR-168). */
export const saveProjectFields = defineAction({
  ...saveProjectFieldsConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveProjectFieldsContent(await createContentStore(), input);
    log.info("site content saved", { setting: done.key, count: input.fields.length });
    return done;
  },
});

/** Saves the Prime project amounts (ADR-208): every project's Prime tag follows them from the next read. */
export const saveProjectPrime = defineAction({
  ...saveProjectPrimeConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveProjectPrimeContent(await createContentStore(), input);
    log.info("site content saved", { setting: done.key });
    return done;
  },
});

/** Saves which developers the home page shows under "Top developers", and their order (at most 10). */
export const saveTopDevelopers = defineAction({
  ...saveTopDevelopersConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveTopDevelopersContent(await createContentStore(), input);
    log.info("site content saved", { setting: done.key });
    return done;
  },
});

/** Saves the builders and agents picked for the Featured card and the Developer Spotlight (ADR-191). */
export const saveSponsoredBuilders = defineAction({
  ...saveSponsoredBuildersConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveSponsoredBuildersContent(await createContentStore(), input);
    log.info("site content saved", { setting: done.key });
    return done;
  },
});
