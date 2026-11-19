"use client";

import { useLocale } from "next-intl";
import { ContentModuleBar, type ContentModuleId } from "@/components/domain/content-module-bar";
import { useContentModuleSwitches, type SaveContentModules } from "./switches.client";
import type { ContentModulesView } from "./view";

type ContentModulePageBarProps = {
  /** Which module this admin page belongs to. */
  module: ContentModuleId;
  /** The three modules as saved, with their counts (read by the page): a save writes all three switches. */
  modules: ContentModulesView;
  /** The save action, passed by the page. */
  save: SaveContentModules;
};

/**
 * The switch at the top of a module's admin page (ADR-143, FR-ADM-16): the same switch as on the dashboard, for the one
 * module of the page. The admin pages keep working while the module is hidden, so the page never goes away with it.
 */
export function ContentModulePageBar({ module, modules, save }: ContentModulePageBarProps) {
  const locale = useLocale();
  const { rows, change } = useContentModuleSwitches(modules, save);
  const row = rows.find((candidate) => candidate.module === module);
  if (!row) return null;
  return (
    <ContentModuleBar
      module={module}
      live={row.live}
      published={row.published}
      drafts={row.drafts}
      status={row.status ?? "idle"}
      {...(row.problem ? { problem: row.problem } : {})}
      disabled={rows.some((candidate) => candidate.status === "pending")}
      locale={locale}
      onChange={(next) => change(module, next)}
    />
  );
}
