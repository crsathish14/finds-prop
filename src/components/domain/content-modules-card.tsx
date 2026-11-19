"use client";

/**
 * ContentModulesCard: the dashboard card that switches Blog, FAQ and Careers on and off.
 * Purpose: ADR-143 puts the three switches in one place on the admin overview: a row per module with its switch,
 *   Live or Hidden, the counts of published and draft items and what turning it off does. Owner: design system.
 *   It holds no state of its own beyond each row's question before turning off; the page sends the change.
 * Props: modules ({ module, live, published?, drafts?, status?, problem? }[], in the order shown), onChange(module,
 *   next), locale ("en" default), className. A change being saved (a row with status "pending") switches the other
 *   rows off, because one save writes all three switches.
 * Responsive: one column; inside a row the counts sit beside the switch from 768 px and under it below that.
 * Accessibility: the card is a section named by its heading; each row is a section named by its switch (see
 *   ContentModuleBar); rows are a list.
 * States: every row live, some hidden, a row saving, saved or failed, counts missing (dashes).
 * Dependencies: ChartCard, ContentModuleBar, next-intl.
 * Tests: content-modules.test.tsx; Design Lab "Content modules card" (ADR-143).
 * UX reference: none yet; drawn for the owner's approval (the admin overview screen, ADR-143 section 5).
 */
import { useTranslations } from "next-intl";
import { ChartCard } from "@/components/patterns/chart-card";
import { cn } from "@/lib/cn";
import {
  ContentModuleBar,
  type ContentModuleId,
  type ContentModuleStatus,
} from "./content-module-bar";

type ContentModuleRow = {
  module: ContentModuleId;
  live: boolean;
  published?: number | null | undefined;
  drafts?: number | null | undefined;
  status?: ContentModuleStatus;
  problem?: string;
};

type ContentModulesCardProps = {
  modules: readonly ContentModuleRow[];
  onChange: (module: ContentModuleId, next: boolean) => void;
  locale?: string;
  className?: string;
};

function ContentModulesCard({
  modules,
  onChange,
  locale = "en",
  className,
}: ContentModulesCardProps) {
  const translate = useTranslations();
  const saving = modules.some((row) => row.status === "pending");
  return (
    <ChartCard
      className={cn(className)}
      title={translate("admin.contentModules.title")}
      description={translate("admin.contentModules.description")}
    >
      <ul data-slot="content-modules-card" className="flex flex-col divide-y divide-line">
        {modules.map((row) => (
          <li key={row.module} className="py-4 first:pt-0 last:pb-0">
            <ContentModuleBar
              framed={false}
              module={row.module}
              live={row.live}
              published={row.published}
              drafts={row.drafts}
              status={row.status ?? "idle"}
              {...(row.problem ? { problem: row.problem } : {})}
              disabled={saving}
              locale={locale}
              onChange={(next) => onChange(row.module, next)}
            />
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

export { ContentModulesCard };
export type { ContentModuleRow, ContentModulesCardProps };
