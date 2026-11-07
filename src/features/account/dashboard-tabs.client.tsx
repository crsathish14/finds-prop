"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/patterns/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardTabSchema, type DashboardTab, type TabCounts } from "./schemas";
import { tabHref } from "./tabs";

const TAB_ORDER: readonly DashboardTab[] = ["saved", "listings", "received", "sent"];

/** A few rows where the next tab's content will be, until the server has made it. */
function PanelWaiting() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <Skeleton shape="row" />
      <Skeleton shape="row" />
      <Skeleton shape="row" />
    </div>
  );
}

type DashboardTabsViewProps = {
  /** The tab whose content `children` is. */
  active: DashboardTab;
  /** The tab marked as chosen; when it is not `active`, the panel waits for that tab's content. */
  chosen?: DashboardTab;
  /** The four tab names, already translated. */
  labels: Record<DashboardTab, string>;
  /** What the tab list is called for a screen reader, already translated. */
  listLabel: string;
  /** The numbers on the tabs, if any (S6-T03). A count is part of the tab's name for a screen reader. */
  counts?: TabCounts;
  onSelect: (tab: DashboardTab) => void;
  children: ReactNode;
};

/** The tabs drawn from what they are given, so the Design Lab can show them with no router behind them. */
export function DashboardTabsView({
  active,
  chosen = active,
  labels,
  listLabel,
  counts,
  onSelect,
  children,
}: DashboardTabsViewProps) {
  return (
    <Tabs
      value={chosen}
      onValueChange={(value) => {
        const parsed = dashboardTabSchema.safeParse(value);
        if (parsed.success) onSelect(parsed.data);
      }}
    >
      <TabsList aria-label={listLabel}>
        {TAB_ORDER.map((tab) => (
          <TabsTrigger
            key={tab}
            value={tab}
            {...(counts?.[tab]
              ? { count: counts[tab].value, countTone: counts[tab].tone ?? "default" }
              : {})}
          >
            {labels[tab]}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={chosen} aria-busy={chosen !== active}>
        {chosen === active ? children : <PanelWaiting />}
      </TabsContent>
    </Tabs>
  );
}

type DashboardTabsProps = Omit<DashboardTabsViewProps, "chosen" | "onSelect">;

/**
 * The tabs of the dashboard. The address holds the tab (`?tab=`), so a tab can be linked, reloaded and
 * reached with the back button. A tap on a tab marks it at once and asks the server for that tab's
 * content, which only the page can make; until it arrives the panel shows a few waiting rows. Only the
 * active tab's content exists, so a tab with a long list is read when it is opened, not before.
 */
export function DashboardTabs(props: DashboardTabsProps) {
  const router = useRouter();
  const [chosen, setChosen] = useOptimistic(props.active);
  const [, startTransition] = useTransition();
  return (
    <DashboardTabsView
      {...props}
      chosen={chosen}
      onSelect={(tab) =>
        startTransition(() => {
          setChosen(tab);
          router.replace(tabHref(tab), { scroll: false });
        })
      }
    />
  );
}
