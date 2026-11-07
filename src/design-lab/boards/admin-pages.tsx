import type { ReactNode } from "react";
import { AvatarMenu } from "@/components/layout/avatar-menu";
import { PortalShell } from "@/components/layout/portal-shell";
import { Heading } from "@/components/ui/heading";
import { Link } from "@/components/ui/link";
import { Logo } from "@/components/ui/logo";
import { Text } from "@/components/ui/text";
import { ACCOUNT_GROUPS, PORTAL_FOOTER, PORTAL_GROUPS } from "../sample-data";
import { SampleQueue, SampleReject, SampleReview } from "./admin-parts";

/**
 * The admin portal around the listings queue, for the whole-page previews of the Admin board (S6-T04): the
 * sidebar with "Listings" as the current page, the queue, and one overlay open on top.
 */

const GROUPS = PORTAL_GROUPS.map((group) => ({
  ...group,
  items: group.items.map((item) => ({
    ...item,
    current: item.href === "#listings",
    ...(item.href === "#listings" ? { count: 14 } : {}),
  })),
}));

function ListingsPage({ overlay }: { overlay?: ReactNode }) {
  return (
    <PortalShell
      brand={
        <Link href="#home" aria-label="Find Prop, home" className="no-underline">
          <Logo name="Find Prop" tone="on-dark" />
        </Link>
      }
      portalTag="Admin"
      navLabel="Admin"
      groups={GROUPS}
      footerItems={PORTAL_FOOTER}
      mobileLogo={
        <Link href="#home" aria-label="Find Prop, home" className="no-underline">
          <Logo name="Find Prop" />
        </Link>
      }
      mobileMenu={{ triggerLabel: "Open menu", title: "Admin menu", closeLabel: "Close menu" }}
      topBar={
        <AvatarMenu
          triggerLabel="Account menu"
          name="Asha Menon"
          email="asha@example.com"
          initials="AM"
          roleLabel="Admin"
          roleTone="admin"
          groups={ACCOUNT_GROUPS.slice(-1)}
        />
      }
    >
      <div className="flex flex-col gap-6 pb-6">
        <div className="flex flex-col gap-2">
          <Heading as="h1" size="1">
            Listings
          </Heading>
          <Text tone="muted">
            Review listings posted by owners. Only approved listings appear on Find Prop.
          </Text>
        </div>
        {/* With an overlay open the page is one screen tall, so the overlay covers all of it. */}
        <SampleQueue compact={overlay !== undefined} />
      </div>
      {overlay}
    </PortalShell>
  );
}

export function AdminListingsPreview() {
  return <ListingsPage />;
}

export function AdminReviewPreview() {
  return <ListingsPage overlay={<SampleReview open />} />;
}

export function AdminRejectPreview() {
  return (
    <ListingsPage overlay={<SampleReject initiallyOpen error="Tell the owner what to fix." />} />
  );
}
