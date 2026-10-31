"use client";

/**
 * AvatarMenu: the signed-in person's picture, which opens their account menu.
 * Purpose: the account entry in the header and the portal top bar, with workspace links, counts
 *   and Sign out. Owner: design system. Which entries appear depends on the role; the caller
 *   builds the groups.
 * Props: triggerLabel (required, already-translated, e.g. "Account menu"), name, email, initials,
 *   roleLabel (e.g. "Admin" or "Builder") with roleTone ("default" | "admin"), groups (MenuGroup
 *   list: optional heading, then entries with label, href or onSelect, icon, count, current,
 *   destructive), imageSrc (optional photo).
 * Responsive: on phones only the picture shows; from 768 px it sits in a pill with a chevron.
 *   The menu is 320 px wide and aligned to the right edge.
 * Accessibility: a menu button (aria-expanded); arrow keys, Home, End and typeahead move; Escape
 *   closes and returns focus to the button. The current page gets aria-current="page". Counts are
 *   part of the entry's name.
 * States: closed, open, hover, focus. Dependencies: DropdownMenu, Avatar, Link, Icon, cn.
 * Tests: layout.test.tsx; Design Lab "Navigation" (S2-T07).
 * UX reference: ds-navigation, avatar menu (c-nav.css .avatar-btn, .hdr-menu).
 */
import { ChevronDown } from "lucide-react";
import { Fragment } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/patterns/dropdown-menu";
import { cn } from "@/lib/cn";
import type { MenuGroup } from "./nav-types";

type AvatarMenuProps = {
  triggerLabel: string;
  name: string;
  email?: string;
  initials: string;
  roleLabel?: string;
  roleTone?: "default" | "admin";
  imageSrc?: string;
  groups: MenuGroup[];
};

function AvatarMenu({
  triggerLabel,
  name,
  email,
  initials,
  roleLabel,
  roleTone = "default",
  imageSrc,
  groups,
}: AvatarMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={triggerLabel}
        className={cn(
          "inline-flex items-center gap-2 rounded-pill transition-colors duration-(--dur-fast)",
          "md:border-[length:var(--bw-field)] md:border-line-strong md:bg-surface md:py-1 md:pr-3 md:pl-1",
          "hover:border-primary aria-expanded:border-primary",
        )}
      >
        <Avatar className="size-10 md:size-9.5">
          {imageSrc ? <AvatarImage src={imageSrc} alt="" /> : null}
          {/* The initials are drawn by CSS, not written as text: the button is named by its label, and a
              visible text that differs from the name would fail WCAG 2.5.3 (label in name). */}
          <AvatarFallback
            data-initials={initials}
            className="bg-primary text-on-primary before:content-[attr(data-initials)]"
          />
        </Avatar>
        <Icon icon={ChevronDown} className="hidden text-muted md:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center gap-3 px-3 pt-3 pb-3">
          <Avatar className="size-12">
            {imageSrc ? <AvatarImage src={imageSrc} alt="" /> : null}
            <AvatarFallback className="bg-primary text-on-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-title-sm text-ink">{name}</p>
            {email ? <p className="text-caption break-all text-muted">{email}</p> : null}
            {roleLabel ? (
              <span
                className={cn(
                  "mt-1 inline-flex rounded-pill px-2 py-1 text-overline",
                  roleTone === "admin" ? "bg-ink text-on-primary" : "bg-primary-tint text-primary",
                )}
              >
                {roleLabel}
              </span>
            ) : null}
          </div>
        </div>
        {groups.map((group, groupIndex) => (
          <Fragment key={groupIndex}>
            <DropdownMenuSeparator />
            {group.label ? <DropdownMenuLabel>{group.label}</DropdownMenuLabel> : null}
            {group.items.map((entry) => (
              <DropdownMenuItem
                key={entry.label}
                icon={entry.icon}
                meta={entry.count}
                metaTone={entry.countTone}
                destructive={entry.destructive}
                onSelect={entry.onSelect}
                asChild={Boolean(entry.href)}
                className={entry.current ? "bg-primary-tint" : undefined}
              >
                {entry.href ? (
                  <Link
                    href={entry.href}
                    current={entry.current}
                    className="flex w-full items-center gap-3 font-semibold text-ink no-underline"
                  >
                    {entry.icon ? (
                      <span className="shrink-0 text-primary">{entry.icon}</span>
                    ) : null}
                    {entry.label}
                    {entry.count !== undefined ? (
                      <span
                        className={cn(
                          "ml-auto inline-grid h-5.5 min-w-5.5 place-items-center rounded-pill px-2 text-caption font-bold",
                          entry.countTone === "new"
                            ? "bg-cta text-on-cta"
                            : "bg-canvas-sunken text-ink",
                        )}
                      >
                        {entry.count}
                      </span>
                    ) : null}
                  </Link>
                ) : (
                  entry.label
                )}
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { AvatarMenu };
