import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { Logo } from "@/components/ui/logo";
import { markCurrent, type HeaderModel, type NavLink } from "./chrome";

export type HeaderViewProps = {
  header: HeaderModel;
  labels: { nav: string; home: string };
  /** The page the visitor is on, to mark the current link. Left out while it is not yet known. */
  pathname?: string | undefined;
  /** The right side after Post property: Sign in, or the saved link and the account menu. */
  accountSlot: ReactNode;
  /** The menu button and drawer, which need to know who is signed in. */
  menuSlot: ReactNode;
};

/**
 * The public header laid out from its data (S4-T06). It holds no hooks, so the page can render it
 * once without a path (the loading look) and the client frame can render it again with the path.
 */
export function HeaderView({ header, labels, pathname, accountSlot, menuSlot }: HeaderViewProps) {
  const links: (NavLink & { current?: boolean })[] =
    pathname === undefined ? header.links : markCurrent(header.links, pathname);
  const nav = links.map((link) => ({
    label: link.label,
    href: link.href,
    ...(link.current ? { current: true } : {}),
    ...(link.accent ? { accent: true, icon: <Icon icon={Sparkles} size="sm" /> } : {}),
  }));
  return (
    <SiteHeader
      logo={
        <Link href="/" aria-label={labels.home} className="no-underline">
          <Logo name={header.brandName} />
        </Link>
      }
      navLabel={labels.nav}
      nav={nav}
      bordered={pathname !== undefined && pathname !== "/"}
      actions={
        <>
          {header.cta ? (
            <Button asChild variant="secondary" size="sm" pill className="hidden md:inline-flex">
              <Link href={header.cta.href} className="no-underline">
                {header.cta.label}
              </Link>
            </Button>
          ) : null}
          {accountSlot}
        </>
      }
      menu={menuSlot}
    />
  );
}
