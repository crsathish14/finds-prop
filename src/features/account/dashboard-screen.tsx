import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { DashboardTabs, DashboardTabsView } from "./dashboard-tabs.client";
import type { DashboardTab, TabCounts } from "./schemas";

type DashboardScreenProps = {
  /** The name the person gave, or null when they skipped that step. */
  name: string | null;
  /** The tab the address names. */
  active: DashboardTab;
  /** Where "Post a property" leads. */
  postHref: string;
  /** Shows "Email not verified" beside the line under the heading (a link was sent, not used yet). */
  emailPending?: boolean;
  /** The email prompt or its reminder, between the heading and the tabs. */
  notice?: ReactNode;
  /** The numbers on the tabs, if any. */
  counts?: TabCounts;
  /** What the active tab shows. */
  children: ReactNode;
  /** Design Lab only: change the tab without going anywhere. */
  onSelect?: (tab: DashboardTab) => void;
  /** Design Lab only: several screens on one board need their own heading level and id. */
  titleAs?: "h1" | "h2";
  titleId?: string;
};

/**
 * The dashboard below the site header (S5-T04, FR-ACC-01): the heading with a line that names the
 * person when it can, "Post a property", the email prompt or reminder, the four tabs and the active
 * tab's content. It fetches nothing and holds no state of its own, so the Design Lab draws every state
 * with sample content. A name that was skipped at sign-in is simply left out of the line.
 */
export function DashboardScreen({
  name,
  active,
  postHref,
  emailPending = false,
  notice,
  counts,
  children,
  onSelect,
  titleAs = "h1",
  titleId = "dashboard-title",
}: DashboardScreenProps) {
  const translate = useTranslations("account.dashboard");
  const trimmed = name?.trim();
  const tabProps = {
    active,
    ...(counts ? { counts } : {}),
    listLabel: translate("tabsLabel"),
    labels: {
      saved: translate("tabs.saved"),
      listings: translate("tabs.listings"),
      received: translate("tabs.received"),
      sent: translate("tabs.sent"),
    },
  };
  return (
    <Container className="py-6 md:py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Heading as={titleAs} size="1" id={titleId} tabIndex={-1}>
            {translate("title")}
          </Heading>
          <Text tone="muted">
            {trimmed ? translate("subNamed", { name: trimmed }) : translate("sub")}
            {emailPending ? (
              <>
                {" "}
                <Badge tone="warning" dot>
                  {translate("email.badge")}
                </Badge>
              </>
            ) : null}
          </Text>
        </div>
        <Button asChild variant="accent">
          <Link href={postHref} className="text-on-cta no-underline hover:text-on-cta">
            <Icon icon={Plus} size="sm" />
            {translate("post")}
          </Link>
        </Button>
      </div>

      {notice}

      {onSelect ? (
        <DashboardTabsView {...tabProps} onSelect={onSelect}>
          {children}
        </DashboardTabsView>
      ) : (
        <DashboardTabs {...tabProps}>{children}</DashboardTabs>
      )}
    </Container>
  );
}
