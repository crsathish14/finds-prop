import { useTranslations } from "next-intl";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { queueHref } from "./href";
import type { QueueFilters } from "./schemas";
import type { QueueCounts, QueuePage } from "./view";
import { ListingsBoard, type ListingsBoardActions } from "./listings-board.client";

type ListingsScreenProps = {
  filters: QueueFilters;
  page: QueuePage;
  counts: QueueCounts;
  localities: string[];
  actions: ListingsBoardActions;
};

/**
 * The admin's listings page inside the portal frame (S6-T04, FR-ADM-02): the heading and its line, then the board
 * (tabs, filters, queue, drawer, dialog). It reads nothing itself; the page passes what it read. The board is
 * keyed by the filters, so changing a tab or a filter starts it afresh (rows from "Show more" belong to one set of
 * filters only).
 */
export function ListingsScreen({
  filters,
  page,
  counts,
  localities,
  actions,
}: ListingsScreenProps) {
  const translate = useTranslations("admin.listings");
  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="flex flex-col gap-2">
        <Heading as="h1" size="1">
          {translate("title")}
        </Heading>
        <Text tone="muted">{translate("intro")}</Text>
      </div>
      <ListingsBoard
        key={queueHref(filters)}
        filters={filters}
        items={page.items}
        nextCursor={page.nextCursor}
        counts={counts}
        localities={localities}
        actions={actions}
      />
    </div>
  );
}
