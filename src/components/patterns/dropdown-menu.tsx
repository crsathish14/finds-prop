"use client";

/**
 * DropdownMenu: a list of actions or links that opens from a button (account menu, row actions).
 * Purpose: wraps Radix DropdownMenu. Owner: design system. Menus inside scrolling tables are
 *   portalled, so the table does not clip them.
 * Props: DropdownMenu (root), DropdownMenuTrigger (use asChild with a Button or IconButton),
 *   DropdownMenuContent (align, side), DropdownMenuItem (icon, meta, destructive, asChild for a
 *   link), DropdownMenuLabel, DropdownMenuSeparator. `meta` is a small count at the right, e.g.
 *   "3", with metaTone "new" for the copper "N new" count.
 * Responsive: at least 240 px wide; on phones prefer a Sheet for long lists.
 * Accessibility: role menu; arrow keys, Home, End and typeahead move; Escape closes and returns
 *   focus to the trigger. The trigger needs its own accessible name.
 * States: default, hover and keyboard highlight, current (aria-current), destructive, disabled.
 * Dependencies: radix DropdownMenu, cn. Tests: overlays.test.tsx; Design Lab "Navigation" (S2-T07).
 * UX reference: ds-navigation, avatar menu (c-core.css .menu).
 */
import { DropdownMenu as MenuPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

function DropdownMenu(props: ComponentProps<typeof MenuPrimitive.Root>) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger(props: ComponentProps<typeof MenuPrimitive.Trigger>) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "z-menu min-w-60 rounded-lg border border-line bg-surface p-2 shadow-pop",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

type DropdownMenuItemProps = ComponentProps<typeof MenuPrimitive.Item> & {
  icon?: ReactNode;
  meta?: ReactNode;
  metaTone?: "default" | "new";
  destructive?: boolean;
};

function DropdownMenuItem({
  className,
  icon,
  meta,
  metaTone = "default",
  destructive = false,
  asChild,
  children,
  ...props
}: DropdownMenuItemProps) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      asChild={asChild}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-3 text-left text-title-sm outline-none",
        "data-[highlighted]:bg-canvas-sunken aria-[current=page]:bg-primary-tint",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        destructive ? "text-danger" : "text-ink",
        className,
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {icon ? (
            <span className={cn("shrink-0", destructive ? "text-danger" : "text-primary")}>
              {icon}
            </span>
          ) : null}
          {children}
          {meta !== undefined ? (
            <span
              className={cn(
                "ml-auto inline-grid h-5.5 min-w-5.5 place-items-center rounded-pill px-2 text-caption font-bold",
                metaTone === "new" ? "bg-cta text-on-cta" : "bg-canvas-sunken text-ink",
              )}
            >
              {meta}
            </span>
          ) : null}
        </>
      )}
    </MenuPrimitive.Item>
  );
}

function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof MenuPrimitive.Label>) {
  return (
    <MenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn("px-3 pt-2 pb-1 text-overline text-muted", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("mx-2 my-2 h-px bg-line", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
