// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Bell,
  Heart,
  Home,
  LayoutDashboard,
  LogOut,
  Phone,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { Logo } from "@/components/ui/logo";
import { AvatarMenu } from "../avatar-menu";
import { BottomBar } from "../bottom-bar";
import { Container } from "../container";
import { MobileDrawer } from "../mobile-drawer";
import type { NavItem } from "../nav-types";
import { PortalShell } from "../portal-shell";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";

const NAV: NavItem[] = [
  { label: "Buy", href: "/search?type=buy", current: true },
  { label: "Rent", href: "/search?type=rent" },
  { label: "Projects", href: "/projects" },
  {
    label: "AI Search",
    href: "/ai-search",
    accent: true,
    icon: <Icon icon={Sparkles} size="sm" />,
  },
  { label: "Contact", href: "/contact" },
];

describe("Container", () => {
  it("is a full-width block with the gutter and a max width, and can be another element", () => {
    const { container } = render(
      <Container as="section" size="narrow">
        Text
      </Container>,
    );
    const section = container.querySelector("section");
    expect(section).toHaveClass("mx-auto", "w-full", "px-gutter");
    expect(section?.className).toContain("--container-narrow");
  });
});

describe("SiteHeader", () => {
  function Example({ bordered = false }: { bordered?: boolean }) {
    return (
      <SiteHeader
        bordered={bordered}
        logo={
          <Link href="/" aria-label="Find Prop, home">
            <Logo name="Find Prop" />
          </Link>
        }
        navLabel="Main"
        nav={NAV}
        actions={<Link href="/sign-in">Sign in</Link>}
        menu={
          <MobileDrawer triggerLabel="Open menu" title="Menu" closeLabel="Close menu" nav={NAV} />
        }
      />
    );
  }

  it("is a banner with a labelled main navigation and marks the current page", () => {
    render(<Example />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getAllByRole("link")).toHaveLength(5);
    expect(within(nav).getByRole("link", { name: "Buy" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Rent" })).not.toHaveAttribute("aria-current");
  });

  it("gives the AI Search link the copper accent and its icon", () => {
    render(<Example />);
    const link = screen.getByRole("link", { name: "AI Search" });
    expect(link).toHaveClass("text-cta-text");
    expect(link.querySelector("svg")).toBeInTheDocument();
  });

  it("names the home link and puts the actions and the menu button in the header", () => {
    render(<Example />);
    expect(screen.getByRole("link", { name: "Find Prop, home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
  });

  it("is sticky, and draws its bottom line only when asked", () => {
    const { rerender } = render(<Example />);
    expect(screen.getByRole("banner")).toHaveClass("sticky", "border-transparent");
    rerender(<Example bordered />);
    expect(screen.getByRole("banner")).toHaveClass("border-line");
  });
});

describe("MobileDrawer", () => {
  it("opens from the menu button as a named dialog with the nav, groups and actions", async () => {
    render(
      <MobileDrawer
        triggerLabel="Open menu"
        title="Menu"
        closeLabel="Close menu"
        nav={NAV}
        groups={[
          {
            label: "Your account",
            items: [
              { label: "Saved homes", href: "/saved", icon: <Icon icon={Heart} />, count: 3 },
            ],
          },
        ]}
        actions={<Button variant="accent">Post property</Button>}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    expect(within(dialog).getByRole("link", { name: "Buy" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(dialog).getByText("Your account")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /Saved homes/ })).toHaveTextContent("3");
    expect(within(dialog).getByRole("button", { name: "Post property" })).toBeInTheDocument();
  });

  it("closes when a link is chosen, and with Escape, returning focus to the menu button", async () => {
    render(
      <MobileDrawer triggerLabel="Open menu" title="Menu" closeLabel="Close menu" nav={NAV} />,
    );
    const trigger = screen.getByRole("button", { name: "Open menu" });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("link", { name: "Rent" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe("AvatarMenu", () => {
  const onSignOut = vi.fn();
  const props = {
    triggerLabel: "Account menu",
    name: "Priya Raman",
    email: "priya@example.com",
    initials: "PR",
    roleLabel: "Builder",
    groups: [
      {
        items: [
          {
            label: "Dashboard",
            href: "/dashboard",
            icon: <Icon icon={LayoutDashboard} />,
            current: true,
          },
          {
            label: "Enquiries",
            href: "/dashboard#enquiries",
            icon: <Icon icon={Bell} />,
            count: 2,
            countTone: "new" as const,
          },
        ],
      },
      {
        items: [
          {
            label: "Sign out",
            icon: <Icon icon={LogOut} />,
            onSelect: onSignOut,
            destructive: true,
          },
        ],
      },
    ],
  };

  it("is a menu button that shows who is signed in, with a role and the workspace links", async () => {
    render(<AvatarMenu {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Priya Raman")).toBeInTheDocument();
    expect(within(menu).getByText("priya@example.com")).toBeInTheDocument();
    expect(within(menu).getByText("Builder")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /Dashboard/ })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(within(menu).getByRole("menuitem", { name: /Enquiries/ })).toHaveTextContent("2");
  });

  it("runs the chosen action and closes", async () => {
    render(<AvatarMenu {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Sign out/ }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shows initials as the picture when there is no photo", () => {
    render(<AvatarMenu {...props} />);
    expect(document.querySelector("[data-initials=PR]")).toBeInTheDocument();
  });
});

describe("BottomBar", () => {
  const items = [
    { label: "Home", href: "/", icon: <Icon icon={Home} />, current: true },
    { label: "Search", href: "/search", icon: <Icon icon={Search} /> },
    { label: "Post", href: "/post-property", icon: <Icon icon={Phone} />, raised: true },
    { label: "Saved", href: "/saved", icon: <Icon icon={Heart} />, badge: 3 },
    { label: "Me", href: "/me", icon: <Icon icon={User} /> },
  ];

  it("is a labelled nav of five links, with the current one marked", () => {
    render(<BottomBar navLabel="Primary" items={items} />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getAllByRole("link")).toHaveLength(5);
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  });

  it("includes the badge in the name of the item, and raises the middle action", () => {
    render(<BottomBar navLabel="Primary" items={items} />);
    expect(screen.getByRole("link", { name: /Saved/ })).toHaveTextContent("3");
    expect(screen.getByRole("link", { name: "Post" }).firstElementChild).toHaveClass("bg-primary");
  });

  it("is hidden from 768 px", () => {
    render(<BottomBar navLabel="Primary" items={items} />);
    expect(screen.getByRole("navigation")).toHaveClass("md:hidden");
  });
});

describe("SiteFooter", () => {
  function Example() {
    return (
      <SiteFooter
        logo={<Logo name="Find Prop" tone="on-dark" />}
        about="Search, shortlist and compare homes."
        navLabel="Footer"
        columns={[
          { heading: "Explore", links: [{ label: "Buy a home", href: "/search?type=buy" }] },
          {
            heading: "Company",
            links: [
              { label: "Builder sign in", href: "/builder/sign-in" },
              {
                label: "Partner site",
                href: "https://partner.example",
                external: true,
                newTabLabel: "(opens in a new tab)",
              },
            ],
          },
        ]}
        contacts={[
          { icon: <Icon icon={Phone} />, text: "+91 44 0000 0000", href: "tel:+914400000000" },
        ]}
        legal={{ copyright: "2026 Find Prop", links: [{ label: "Privacy", href: "/privacy" }] }}
      />
    );
  }

  it("is a content-info landmark with link columns, contact details and a legal line", () => {
    render(<Example />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Footer" });
    expect(within(nav).getByRole("heading", { name: "Explore" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Buy a home" })).toHaveAttribute(
      "href",
      "/search?type=buy",
    );
    expect(screen.getByRole("link", { name: "+91 44 0000 0000" })).toBeInTheDocument();
    expect(screen.getByText("2026 Find Prop")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy" })).toBeInTheDocument();
  });

  it("opens an external link in a new tab safely", () => {
    render(<Example />);
    const link = screen.getByRole("link", { name: /Partner site/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");
  });

  it("is a dark surface, so the focus ring switches to the light copper", () => {
    render(<Example />);
    expect(screen.getByRole("contentinfo")).toHaveClass("on-dark", "bg-dark");
  });
});

describe("PortalShell", () => {
  function Example() {
    return (
      <PortalShell
        brand={<Logo name="Find Prop" tone="on-dark" />}
        portalTag="Admin"
        navLabel="Admin"
        groups={[
          {
            items: [
              {
                label: "Overview",
                href: "/admin",
                icon: <Icon icon={LayoutDashboard} />,
                current: true,
              },
              { label: "Leads", href: "/admin/leads", icon: <Icon icon={Bell} />, count: 4 },
            ],
          },
        ]}
        footerItems={[{ label: "Settings", href: "/admin/settings", icon: <Icon icon={User} /> }]}
        topBar={<Link href="/">View site</Link>}
        mobileLogo={<Logo name="Find Prop" />}
        mobileMenu={{ triggerLabel: "Open menu", title: "Admin menu", closeLabel: "Close menu" }}
      >
        <h1>Overview</h1>
      </PortalShell>
    );
  }

  it("has a labelled sidebar nav with counts, a current item and footer items", () => {
    render(<Example />);
    const nav = screen.getAllByRole("navigation", { name: "Admin" })[0] as HTMLElement;
    expect(within(nav).getByRole("link", { name: /Overview/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: /Leads/ })).toHaveTextContent("4");
    expect(within(nav).getByRole("link", { name: /Settings/ })).toBeInTheDocument();
  });

  it("keeps each item's text for the icon rail, only hidden visually", () => {
    render(<Example />);
    const label = screen.getAllByText("Leads")[0];
    expect(label).toHaveClass("md:max-portal:sr-only");
  });

  it("holds the page in a main landmark with the skip target and the top bar", () => {
    render(<Example />);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
    expect(
      within(screen.getByRole("main")).getByRole("heading", { name: "Overview" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View site" })).toBeInTheDocument();
  });

  it("opens the same navigation in a drawer on phones", async () => {
    render(<Example />);
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = screen.getByRole("dialog", { name: "Admin menu" });
    expect(within(dialog).getByRole("link", { name: /Overview/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await userEvent.click(within(dialog).getByRole("link", { name: /Leads/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
