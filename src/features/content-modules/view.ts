import {
  CONTENT_MODULES,
  isContentModuleOn,
  type ContentModule,
  type SiteSettings,
} from "@/features/site";

/**
 * What the admin sees of one content module (ADR-143): whether it is switched on and how many items it has. A count is
 * null when it could not be read, for example while the module's table does not exist yet; the card shows a dash.
 */
export type ContentModuleView = {
  module: ContentModule;
  live: boolean;
  published: number | null;
  drafts: number | null;
};

/** The three modules, always in the order the dashboard shows them. */
export type ContentModulesView = readonly ContentModuleView[];

export type ModuleCounts = { published: number | null; drafts: number | null };

/** The shape the save action takes: all three switches, so one save replaces the whole setting. */
export type ContentModuleSwitches = Record<ContentModule, boolean>;

/** The switches and the counts put together, one row per module in the shared order. */
export function toModulesView(
  settings: SiteSettings,
  counts: Record<ContentModule, ModuleCounts>,
): ContentModulesView {
  return CONTENT_MODULES.map((module) => ({
    module,
    live: isContentModuleOn(settings, module),
    published: counts[module].published,
    drafts: counts[module].drafts,
  }));
}
