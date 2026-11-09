import type { ReactNode } from "react";
import { AdminShell } from "@/features/admin";
import { Link } from "@/components/ui/link";
import { Logo } from "@/components/ui/logo";
import { AccountMenu, getAccountSummary } from "@/features/auth";
import { getSiteSettings, getTranslate, initialsFrom, resolveBrandName } from "@/features/site";
import { getSessionView } from "@/server/auth/get-session-view";
import { buildBuilderNav } from "./nav";

/**
 * The frame around every builder page (S7-T03, FR-BLD-01): the sidebar, the top bar with the account menu and its Sign
 * out (which goes back to the builder sign-in), and the page. It is the admin's frame (`AdminShell`) with the builder's
 * navigation; the role gate is the layout's job (`PageGate`, around this), so this only needs to know who is looking,
 * for the menu. It reads the visitor's cookies, so wrap it in <Suspense>.
 */
export async function BuilderFrame({ children }: { children: ReactNode }) {
  const translate = await getTranslate();
  const session = await getSessionView();
  const [settings, summary] = await Promise.all([
    getSiteSettings(),
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
      groups={buildBuilderNav(translate)}
      viewSite={{ label: translate("builderPortal.shell.viewSite"), href: "/" }}
      labels={{
        nav: translate("builderPortal.shell.navLabel"),
        tag: translate("builderPortal.shell.portalTag"),
        menuOpen: translate("builderPortal.shell.menuOpen"),
        menuTitle: translate("builderPortal.shell.menuTitle"),
        menuClose: translate("builderPortal.shell.menuClose"),
      }}
      brand={home}
      mobileLogo={homeOnLight}
      topBar={
        <AccountMenu
          triggerLabel={translate("site.header.accountMenu")}
          name={summary?.fullName?.trim() || translate("site.header.yourAccount")}
          {...(summary?.email ? { email: summary.email } : {})}
          initials={initialsFrom(summary?.fullName ?? null)}
          roleLabel={translate("site.account.roleBuilder")}
          groups={[]}
          signOut={{
            label: translate("site.header.signOut"),
            failedText: translate("site.header.signOutFailed"),
            destination: "/builder/login",
          }}
        />
      }
    >
      {children}
    </AdminShell>
  );
}
