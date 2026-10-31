/**
 * Sample content for the Design Lab previews: menus, links and names. Not real site content.
 */
import {
  Bell,
  Building2,
  CircleUser,
  Heart,
  House,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import type { FooterColumn, FooterContact } from "@/components/layout/site-footer";
import type { BottomBarItem } from "@/components/layout/bottom-bar";
import type { MenuGroup, NavItem } from "@/components/layout/nav-types";
import type { PortalNavGroup } from "@/components/layout/portal-shell";
import { Icon } from "@/components/ui/icon";

export const MAIN_NAV: NavItem[] = [
  { label: "Buy", href: "#buy", current: true },
  { label: "Rent", href: "#rent" },
  { label: "Projects", href: "#projects" },
  {
    label: "AI Search",
    href: "#ai-search",
    accent: true,
    icon: <Icon icon={Sparkles} size="sm" />,
  },
  { label: "Contact", href: "#contact" },
];

export const ACCOUNT_GROUPS: MenuGroup[] = [
  {
    items: [
      { label: "Saved homes", href: "#saved", icon: <Icon icon={Heart} />, count: 3 },
      { label: "My listings", href: "#listings", icon: <Icon icon={ListChecks} /> },
      {
        label: "Enquiries",
        href: "#enquiries",
        icon: <Icon icon={Mail} />,
        count: 2,
        countTone: "new",
      },
    ],
  },
  {
    label: "Workspaces",
    items: [
      { label: "Builder portal", href: "#builder", icon: <Icon icon={Building2} /> },
      { label: "Settings", href: "#settings", icon: <Icon icon={Settings} /> },
    ],
  },
  {
    items: [
      { label: "Sign out", href: "#sign-out", icon: <Icon icon={LogOut} />, destructive: true },
    ],
  },
];

export const BOTTOM_BAR_ITEMS: BottomBarItem[] = [
  { label: "Home", href: "#home", icon: <Icon icon={House} />, current: true },
  { label: "Search", href: "#search", icon: <Icon icon={Search} /> },
  { label: "Post", href: "#post", icon: <Icon icon={Plus} />, raised: true },
  { label: "Saved", href: "#saved", icon: <Icon icon={Heart} />, badge: 3 },
  { label: "Me", href: "#me", icon: <Icon icon={CircleUser} /> },
];

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "Explore",
    links: [
      { label: "Buy a home", href: "#buy" },
      { label: "Rent a home", href: "#rent" },
      { label: "New projects", href: "#projects" },
      { label: "AI search", href: "#ai-search" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Contact us", href: "#contact" },
      { label: "Post a property", href: "#post" },
      { label: "Builder sign in", href: "#builder" },
    ],
  },
];

export const FOOTER_CONTACTS: FooterContact[] = [
  { icon: <Icon icon={MapPin} />, text: "12 Sample Road, Chennai 600 001" },
  { icon: <Icon icon={Phone} />, text: "+91 44 0000 0000", href: "tel:+914400000000" },
  { icon: <Icon icon={Mail} />, text: "hello@example.com", href: "mailto:hello@example.com" },
];

export const PORTAL_GROUPS: PortalNavGroup[] = [
  {
    items: [
      {
        label: "Overview",
        href: "#overview",
        icon: <Icon icon={LayoutDashboard} />,
        current: true,
      },
      { label: "Listings", href: "#listings", icon: <Icon icon={ListChecks} />, count: 5 },
      { label: "Leads", href: "#leads", icon: <Icon icon={Mail} />, count: 12 },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Builders", href: "#builders", icon: <Icon icon={Building2} /> },
      { label: "Users", href: "#users", icon: <Icon icon={Users} /> },
      { label: "Notifications", href: "#notifications", icon: <Icon icon={Bell} /> },
    ],
  },
];

export const PORTAL_FOOTER = [
  { label: "Settings", href: "#settings", icon: <Icon icon={Settings} /> },
];
