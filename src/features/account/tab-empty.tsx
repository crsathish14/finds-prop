import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import type { DashboardTab } from "./schemas";

type TabEmptyProps = {
  tab: DashboardTab;
  /** Where "Browse properties" leads. */
  browseHref: string;
  /** Where "Post your property" leads. */
  postHref: string;
};

/**
 * What a tab shows while it has nothing to list (the approved dashboard screen). The lists arrive with
 * the tasks that fill them: Saved (S5-T01), My enquiries (S5-T03), My listings and Enquiries received
 * (Stage 6), and each takes this place when it has rows. Each tab has its own words, written out
 * one by one because the messages check does not follow built keys.
 */
export function TabEmpty({ tab, browseHref, postHref }: TabEmptyProps) {
  const translate = useTranslations("account.dashboard.empty");
  const content =
    tab === "saved"
      ? {
          title: translate("saved.title"),
          body: translate("saved.body"),
          action: translate("saved.action"),
          href: browseHref,
        }
      : tab === "listings"
        ? {
            title: translate("listings.title"),
            body: translate("listings.body"),
            action: translate("listings.action"),
            href: postHref,
          }
        : tab === "received"
          ? {
              title: translate("received.title"),
              body: translate("received.body"),
              action: translate("received.action"),
              href: postHref,
            }
          : {
              title: translate("sent.title"),
              body: translate("sent.body"),
              action: translate("sent.action"),
              href: browseHref,
            };
  return (
    <div role="status" data-slot="dashboard-empty" data-tab={tab}>
      <EmptyState as="h2" title={content.title} description={content.body}>
        <Button asChild variant="primary">
          <Link href={content.href} className="text-on-primary no-underline hover:text-on-primary">
            {content.action}
            <Icon icon={ArrowRight} size="sm" />
          </Link>
        </Button>
      </EmptyState>
    </div>
  );
}
