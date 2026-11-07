// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import type { AdminNavGroup } from "../nav";

const path = vi.hoisted(() => ({ current: "/admin/listings" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));

const { AdminShell } = await import("../admin-shell.client");

const GROUPS: AdminNavGroup[] = [
  { items: [{ key: "overview", href: "/admin/dashboard", label: "Overview", icon: "dashboard" }] },
  {
    label: "Moderation",
    items: [
      { key: "listings", href: "/admin/listings", label: "Listings", icon: "listings", count: 14 },
      { key: "projects", href: "/admin/projects", label: "Projects", icon: "projects" },
    ],
  },
];

function shell() {
  return renderWithMessages(
    <AdminShell
      groups={GROUPS}
      viewSite={{ label: "View public site", href: "/" }}
      labels={{
        nav: "Admin",
        tag: "Admin",
        menuOpen: "Open menu",
        menuTitle: "Admin menu",
        menuClose: "Close menu",
      }}
      brand={<span>Find Prop</span>}
      mobileLogo={<span>Find Prop</span>}
      topBar={<button type="button">Account menu</button>}
    >
      <p>the page</p>
    </AdminShell>,
  );
}

describe("AdminShell: the frame of every admin page (S6-T04)", () => {
  it("is a labelled navigation with the groups, the pending count and the page's content in the main area", () => {
    shell();
    const nav = screen.getAllByRole("navigation", { name: "Admin" })[0];
    if (!nav) throw new Error("no navigation");
    expect(within(nav).getByText("Moderation")).toBeVisible();
    expect(within(nav).getByRole("link", { name: /Listings/ })).toHaveTextContent("14");
    expect(within(nav).getByRole("link", { name: "View public site" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(within(screen.getByRole("main")).getByText("the page")).toBeVisible();
    expect(screen.getByRole("button", { name: "Account menu" })).toBeVisible();
  });

  it("marks the page the admin is on", () => {
    path.current = "/admin/projects/new";
    shell();
    const nav = screen.getAllByRole("navigation", { name: "Admin" })[0];
    if (!nav) throw new Error("no navigation");
    expect(within(nav).getByRole("link", { name: "Projects" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: /Listings/ })).not.toHaveAttribute("aria-current");
  });
});
