import type { LabEntry } from "../types";
import {
  HeaderDemo,
  BottomBarDemo,
  FooterDemo,
  PortalDemo,
  TabsDemo,
  MenuDemo,
  BreadcrumbDemo,
  ErrorScreenDemo,
  StepperDemo,
} from "./navigation-demos";

export const NAVIGATION: LabEntry[] = [
  {
    id: "site-header",
    name: "Site header, avatar menu and mobile drawer",
    description: "The public header at phone, tablet and desktop width, signed out and signed in.",
    sources: ["layout/site-header.tsx", "layout/avatar-menu.tsx", "layout/mobile-drawer.tsx"],
    Demo: HeaderDemo,
  },
  {
    id: "bottom-bar",
    name: "Bottom bar",
    description:
      "Five items with one raised Post action; phones only, so the 820 px frame shows nothing.",
    sources: ["layout/bottom-bar.tsx"],
    Demo: BottomBarDemo,
  },
  {
    id: "site-footer",
    name: "Site footer",
    description: "The dark footer: brand, link columns, contacts and the legal line.",
    sources: ["layout/site-footer.tsx"],
    Demo: FooterDemo,
  },
  {
    id: "portal-shell",
    name: "Portal shell",
    description: "Drawer on phones, 76 px icon rail on tablets, 256 px sidebar from 1100 px.",
    sources: ["layout/portal-shell.tsx"],
    Demo: PortalDemo,
  },
  {
    id: "tabs",
    name: "Tabs",
    description: "Switch views of one page; counts are part of the tab name.",
    sources: ["patterns/tabs.tsx"],
    Demo: TabsDemo,
  },
  {
    id: "dropdown-menu",
    name: "Dropdown menu",
    description: "Row actions and account menus: icons, counts, a destructive item.",
    sources: ["patterns/dropdown-menu.tsx"],
    Demo: MenuDemo,
  },
  {
    id: "breadcrumb",
    name: "Breadcrumb",
    description: "The trail back up the site, and a single back link on small screens.",
    sources: ["patterns/breadcrumb.tsx"],
    Demo: BreadcrumbDemo,
  },
  {
    id: "stepper",
    name: "Stepper",
    description:
      "Numbered steps with done, current, error and upcoming states, and a segmented bar on phones.",
    sources: ["patterns/stepper.tsx"],
    Demo: StepperDemo,
  },
  {
    id: "error-screen",
    name: "Error screens",
    description:
      "Not found and something went wrong: the page every missing or failed page shows, with one or two next steps and a fold-out for the support reference.",
    sources: ["layout/error-screen.tsx"],
    Demo: ErrorScreenDemo,
  },
];
