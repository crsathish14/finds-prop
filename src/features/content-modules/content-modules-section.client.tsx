"use client";

import { useLocale } from "next-intl";
import { ContentModulesCard } from "@/components/domain/content-modules-card";
import { useContentModuleSwitches, type SaveContentModules } from "./switches.client";
import type { ContentModulesView } from "./view";

type ContentModulesSectionProps = {
  /** The three modules as saved, with their counts (read by the page). */
  modules: ContentModulesView;
  /** The save action, passed by the page. */
  save: SaveContentModules;
};

/**
 * The Content modules card on the admin dashboard (ADR-143, FR-ADM-16): a switch per module that saves at once, with a
 * question before a module is hidden. It keeps nothing the server does not also know.
 */
export function ContentModulesSection({ modules, save }: ContentModulesSectionProps) {
  const locale = useLocale();
  const { rows, change } = useContentModuleSwitches(modules, save);
  return <ContentModulesCard modules={rows} locale={locale} onChange={change} />;
}
