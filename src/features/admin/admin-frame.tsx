import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";
import { Link } from "@/components/ui/link";
import { Logo } from "@/components/ui/logo";
import { AccountMenu, getAccountSummary } from "@/features/auth";
import { getQueueCounts } from "@/features/moderation";
import { getSiteSettings, getTranslate, initialsFrom, resolveBrandName } from "@/features/site";
import { getSessionView } from "@/server/auth/get-session-view";
import { logger } from "@/server/logger";
import { AdminShell } from "./admin-shell.client";
import { buildAdminNav } from "./nav";

/**
 * How many listings wait for review, for the number beside Listings in the sidebar. A failed read must not break
 * every admin page, so it is logged and the sidebar shows no number; the listings page itself reads the same
 * counts and shows its own error.
 */
async function readPending(): Promise<number> {
  try {
    return (await getQueueCounts()).pending;
  } catch (error) {
    // Next.js ends a prerender by throwing from cookies(); that must reach Next.js, not be logged.
    unstable_rethrow(error);
    logger.warn("the admin sidebar could not read the pending count, showing no number");
    return 0;
  }
}

/**
 * The frame around every admin page (S6-T04, FR-ADM-02): the sidebar, the top bar with the account menu and its
 * Sign out, and the page. The role gate is the layout's job (`PageGate`, around this); this only needs to know who
 * is looking, for the menu. It reads the visitor's cookies, so wrap it in <Suspense>.
 */
export async function AdminFrame({ children }: { children: ReactNode }) {
  const translate = await getTranslate();
  const session = await getSessionView();
  const [settings, pending, summary] = await Promise.all([
    getSiteSettings(),
    readPending(),
    session ? getAccountSummary(session.userId) : Promise.resolve(null),
  ]);
  const brandName = resolveBrandName(settings.header, translate);
  const home = (
    <Link
      href="/"
      aria-label={translate("site.header.homeLabel", { brandName })}
      className="no-underline"
    >
      <Logo name={brandName} tone="on-dark" />
    </Link>
  );
  const homeOnLight = (
    <Link
      href="/"
      aria-label={translate("site.header.homeLabel", { brandName })}
      className="no-underline"
    >
      <Logo name={brandName} />
    </Link>
  );
  return (
    <AdminShell
      groups={buildAdminNav(translate, pending)}
      viewSite={{ label: translate("admin.shell.viewSite"), href: "/" }}
      labels={{
        nav: translate("admin.shell.navLabel"),
        tag: translate("admin.shell.portalTag"),
        menuOpen: translate("admin.shell.menuOpen"),
        menuTitle: translate("admin.shell.menuTitle"),
        menuClose: translate("admin.shell.menuClose"),
      }}
      brand={home}
      mobileLogo={homeOnLight}
      topBar={
        <AccountMenu
          triggerLabel={translate("site.header.accountMenu")}
          name={summary?.fullName?.trim() || translate("site.header.yourAccount")}
          {...(summary?.email ? { email: summary.email } : {})}
          initials={initialsFrom(summary?.fullName ?? null)}
          roleLabel={translate("site.account.roleAdmin")}
          roleTone="admin"
          groups={[]}
          signOut={{
            label: translate("site.header.signOut"),
            failedText: translate("site.header.signOutFailed"),
            destination: "/admin/login",
          }}
        />
      }
    >
      {children}
    </AdminShell>
  );
}
