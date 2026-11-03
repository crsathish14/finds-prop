// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Heart } from "lucide-react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Icon } from "@/components/ui/icon";
import { AccountDrawer } from "../account-drawer.client";
import type { HeaderModel } from "../chrome";
import { HeaderFrame } from "../header-frame.client";
import { HeaderView } from "../header-view";
import { SignInLink } from "../sign-in-link.client";

const page = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => page.pathname }));

beforeEach(() => {
  page.pathname = "/";
});

const header: HeaderModel = {
  brandName: "Find Prop",
  links: [
    { label: "Buy", href: "/properties" },
    { label: "Rent", href: "/properties" },
    { label: "Projects", href: "/projects" },
    { label: "AI Search", href: "/ai-search", accent: true },
    { label: "Contact", href: "/contact" },
  ],
  cta: { label: "Post property", href: "/post-property" },
};

const view = {
  header,
  labels: { nav: "Main", home: "Find Prop, home" },
  accountSlot: <span>account slot</span>,
  menuSlot: <span>menu slot</span>,
};

function mainNav() {
  return screen.getByRole("navigation", { name: "Main" });
}

describe("HeaderView: the public header laid out from its data (S4-T06)", () => {
  it("shows the logo as the home link, the main links, Post property and the slots", () => {
    render(<HeaderView {...view} />);
    expect(screen.getByRole("link", { name: "Find Prop, home" })).toHaveAttribute("href", "/");
    expect(
      within(mainNav())
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Buy", "Rent", "Projects", "AI Search", "Contact"]);
    expect(screen.getByRole("link", { name: "Post property" })).toHaveAttribute(
      "href",
      "/post-property",
    );
    expect(screen.getByText("account slot")).toBeInTheDocument();
    expect(screen.getByText("menu slot")).toBeInTheDocument();
  });

  it("gives AI Search the accent and its icon", () => {
    render(<HeaderView {...view} />);
    const link = within(mainNav()).getByRole("link", { name: "AI Search" });
    expect(link).toHaveClass("text-cta-text");
    expect(link.querySelector("svg")).toBeInTheDocument();
  });

  it("marks no link as current, and draws no line, until the path is known", () => {
    render(<HeaderView {...view} />);
    expect(mainNav().querySelector("[aria-current]")).toBeNull();
    expect(screen.getByRole("banner")).toHaveClass("border-transparent");
  });

  it("leaves out Post property when the header has none", () => {
    const { cta, ...withoutCta } = header;
    expect(cta).toBeDefined();
    render(<HeaderView {...view} header={withoutCta} />);
    expect(screen.queryByRole("link", { name: "Post property" })).not.toBeInTheDocument();
  });
});

describe("HeaderFrame: the current page is marked from the path", () => {
  it("marks Projects on a project page, and draws the line under the header", () => {
    page.pathname = "/projects/green-acres-ab12cd";
    render(<HeaderFrame {...view} />);
    const current = mainNav().querySelectorAll("[aria-current=page]");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Projects");
    expect(screen.getByRole("banner")).toHaveClass("border-line");
  });

  it("marks only Buy where Buy and Rent share the search page", () => {
    page.pathname = "/properties";
    render(<HeaderFrame {...view} />);
    const current = mainNav().querySelectorAll("[aria-current=page]");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Buy");
  });

  it("marks nothing on the home page, which has no hairline", () => {
    render(<HeaderFrame {...view} />);
    expect(mainNav().querySelector("[aria-current]")).toBeNull();
    expect(screen.getByRole("banner")).toHaveClass("border-transparent");
  });
});

describe("SignInLink: the header's Sign in", () => {
  it("asks to come back to the page the visitor is on", () => {
    page.pathname = "/projects";
    render(<SignInLink label="Sign in" />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/auth?redirect=%2Fprojects",
    );
  });

  it("goes to plain sign-in from the home page", () => {
    render(<SignInLink label="Sign in" />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth");
  });
});

describe("AccountDrawer: the menu drawer", () => {
  const labels = { trigger: "Open menu", title: "Menu", close: "Close menu" };
  const groups: { label?: string; entries: { label: string; href: string; icon: ReactNode }[] }[] =
    [
      {
        label: "Your account",
        entries: [
          { label: "Saved homes", href: "/dashboard?tab=saved", icon: <Icon icon={Heart} /> },
        ],
      },
    ];

  it("shows the main links with the current page marked, the account links and the actions", async () => {
    page.pathname = "/contact";
    render(
      <AccountDrawer
        labels={labels}
        links={header.links}
        groups={groups}
        actions={[{ label: "Post property", href: "/post-property", variant: "accent" }]}
        trailing={<button type="button">Sign out</button>}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    expect(within(dialog).getByRole("link", { name: "Contact" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(dialog).getByText("Your account")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Saved homes" })).toHaveAttribute(
      "href",
      "/dashboard?tab=saved",
    );
    expect(within(dialog).getByRole("link", { name: "Post property" })).toHaveAttribute(
      "href",
      "/post-property",
    );
    expect(within(dialog).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("closes when an action is chosen, so it does not stay open over the next page", async () => {
    render(
      <AccountDrawer
        labels={labels}
        links={header.links}
        groups={[]}
        actions={[{ label: "Sign in", href: "/auth", variant: "secondary" }]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    await userEvent.click(screen.getByRole("link", { name: "Sign in" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
