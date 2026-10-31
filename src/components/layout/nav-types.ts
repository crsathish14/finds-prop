import type { ReactNode } from "react";

/** One link in a main navigation (header, drawer). The label is already translated. */
export type NavItem = {
  label: string;
  href: string;
  /** The page the reader is on: gets aria-current="page" and the active look. */
  current?: boolean;
  /** The copper highlight used for "AI Search". Pass the icon as `icon`. */
  accent?: boolean;
  icon?: ReactNode;
};

/** One entry in a menu, drawer group or sidebar. */
export type MenuEntry = {
  label: string;
  href?: string;
  onSelect?: () => void;
  icon?: ReactNode;
  /** A small count at the right, e.g. new enquiries. */
  count?: number | string;
  countTone?: "default" | "new";
  current?: boolean;
  destructive?: boolean;
};

export type MenuGroup = { label?: string; items: MenuEntry[] };
