import {
  Building2,
  Heart,
  ListChecks,
  Mail,
  Plus,
  Send,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { AccountMenu, SignOutButton, getAccountSummary } from "@/features/auth";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { getSessionView } from "@/server/auth/get-session-view";
import type { SessionView } from "@/server/auth/session";
import type { Translate } from "@/lib/format";
import { logger } from "@/server/logger";
import {
  buildAccountMenu,
  initialsFrom,
  type AccountEntryKey,
  type HeaderModel,
  type NavLink,
} from "./chrome";
import { AccountDrawer } from "./account-drawer.client";
import { SignInLink } from "./sign-in-link.client";
import { getTranslate } from "./translator";

const ENTRY_ICONS: Record<AccountEntryKey, LucideIcon> = {
  savedHomes: Heart,
  myListings: ListChecks,
  enquiriesReceived: Mail,
  myEnquiries: Send,
  postProperty: Plus,
  builderPortal: Building2,
  adminPortal: ShieldCheck,
};

/**
 * Who is signed in, for the header only. A failure to read the roles must not break every page, so
 * it is logged and the header shows the signed-out look; pages that need a session still guard
 * themselves (S3-T11).
 */
async function readSession(): Promise<SessionView | null> {
  try {
    return await getSessionView();
  } catch (error) {
    // Next.js ends a prerender by throwing from cookies(); that must reach Next.js, not be logged.
    unstable_rethrow(error);
    logger.warn("the header could not read the session, showing the signed-out look");
    return null;
  }
}

/** The right side of the header: Sign in for a visitor, the saved link and account menu otherwise. */
export async function HeaderAccountActions() {
  const translate = await getTranslate();
  const session = await readSession();
  if (!session) return <SignInLink label={translate("site.header.signIn")} />;

  const summary = await getAccountSummary(session.userId);
  const menu = buildAccountMenu(session, translate);
  const name = summary.fullName?.trim() || translate("site.header.yourAccount");
  return (
    <>
      <Link
        href="/dashboard?tab=saved"
        variant="nav"
        aria-label={translate("site.account.savedHomes")}
        className="hidden size-(--size-icon-btn) place-items-center rounded-pill text-primary no-underline hover:bg-canvas-sunken md:inline-grid"
      >
        <Icon icon={Heart} />
      </Link>
      <AccountMenu
        triggerLabel={translate("site.header.accountMenu")}
        name={name}
        {...(summary.email ? { email: summary.email } : {})}
        initials={initialsFrom(summary.fullName)}
        {...(menu.roleLabel ? { roleLabel: menu.roleLabel } : {})}
        roleTone={menu.roleTone}
        groups={menu.groups.map((group) => ({
          ...(group.label ? { label: group.label } : {}),
          entries: group.entries.map((entry) => ({
            label: entry.label,
            href: entry.href,
            icon: <Icon icon={ENTRY_ICONS[entry.key]} />,
          })),
        }))}
        signOut={{
          label: translate("site.header.signOut"),
          failedText: translate("site.header.signOutFailed"),
          destination: menu.signOutDestination,
        }}
      />
    </>
  );
}

/** The menu button and drawer: the main links, the account links and the actions for this person. */
export async function HeaderAccountDrawer({
  links,
  cta,
}: {
  links: NavLink[];
  cta: HeaderModel["cta"];
}) {
  const translate = await getTranslate();
  const session = await readSession();
  const postAction = cta ? [{ label: cta.label, href: cta.href, variant: "accent" as const }] : [];

  if (!session) {
    return (
      <AccountDrawer
        labels={drawerLabels(translate)}
        links={links}
        groups={[]}
        actions={[
          { label: translate("site.header.signIn"), href: "/auth", variant: "secondary" },
          ...postAction,
        ]}
      />
    );
  }

  const menu = buildAccountMenu(session, translate);
  // Post a property is a button at the bottom of the drawer, so it is left out of the lists.
  const groups = menu.groups
    .filter((group) => !group.entries.some((entry) => entry.key === "postProperty"))
    .map((group, index) => ({
      label: index === 0 ? translate("site.header.yourAccount") : group.label,
      entries: group.entries.map((entry) => ({
        label: entry.label,
        href: entry.href,
        icon: <Icon icon={ENTRY_ICONS[entry.key]} />,
      })),
    }))
    .map(({ label, entries }) => ({ ...(label ? { label } : {}), entries }));
  return (
    <AccountDrawer
      labels={drawerLabels(translate)}
      links={links}
      groups={groups}
      actions={postAction}
      trailing={
        <SignOutButton
          label={translate("site.header.signOut")}
          failedText={translate("site.header.signOutFailed")}
          destination={menu.signOutDestination}
        />
      }
    />
  );
}

function drawerLabels(translate: Translate) {
  return {
    trigger: translate("site.header.openMenu"),
    title: translate("site.header.menuTitle"),
    close: translate("site.header.closeMenu"),
  };
}
