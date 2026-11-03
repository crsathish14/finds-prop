"use client";

import { Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { SheetClose } from "@/components/patterns/sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { markCurrent, type NavLink } from "./chrome";

export type AccountDrawerProps = {
  labels: { trigger: string; title: string; close: string };
  links: NavLink[];
  /** The account and workspace links of a signed-in person; empty for a visitor. */
  groups: { label?: string; entries: { label: string; href: string; icon: ReactNode }[] }[];
  /** Buttons at the bottom that go to a page: Sign in, Post property. */
  actions: { label: string; href: string; variant: "accent" | "secondary" }[];
  /** Anything after them that is not a link, such as the Sign out button. */
  trailing?: ReactNode;
};

/**
 * The menu drawer for phones and tablets: the main links with the current page marked, the
 * account links and the actions. Choosing a link closes it, so it never stays open over the next
 * page (the header lives in the layout and survives navigation).
 */
export function AccountDrawer({ labels, links, groups, actions, trailing }: AccountDrawerProps) {
  const pathname = usePathname();
  const nav = markCurrent(links, pathname).map((link) => ({
    label: link.label,
    href: link.href,
    ...(link.current ? { current: true } : {}),
    ...(link.accent ? { accent: true, icon: <Icon icon={Sparkles} size="sm" /> } : {}),
  }));
  return (
    <MobileDrawer
      triggerLabel={labels.trigger}
      title={labels.title}
      closeLabel={labels.close}
      nav={nav}
      groups={groups.map((group) => ({
        ...(group.label ? { label: group.label } : {}),
        items: group.entries,
      }))}
      actions={
        <>
          {actions.map((action) => (
            <SheetClose key={action.href} asChild>
              <Button asChild variant={action.variant}>
                <Link href={action.href} className="no-underline">
                  {action.label}
                </Link>
              </Button>
            </SheetClose>
          ))}
          {trailing}
        </>
      }
    />
  );
}
