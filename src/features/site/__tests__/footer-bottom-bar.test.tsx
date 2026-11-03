// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { Home } from "lucide-react";
import { useRequestBottomBar } from "@/lib/bottom-bar-request";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Icon } from "@/components/ui/icon";
import messages from "@/i18n/messages/en.json";
import { SITE_DEFAULTS } from "../defaults";
import type { SiteSettings } from "../schemas";

const state = vi.hoisted(() => ({
  pathname: "/",
  aiSearch: false,
  settings: null as unknown,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("../queries", () => ({ getSiteSettings: async () => state.settings }));
vi.mock("../flags", () => ({
  getFeatureFlags: () => ({ aiSearch: state.aiSearch, mapView: false, pgListings: false }),
}));
vi.mock("../current-year", () => ({ getCurrentYear: async () => 2026 }));
vi.mock("../translator", () => ({
  getTranslate: async () => (key: string, values?: Record<string, string | number>) => {
    let node: unknown = messages;
    for (const part of key.split(".")) node = (node as Record<string, unknown>)[part];
    if (typeof node !== "string") throw new Error(`missing message ${key}`);
    return node.replace(/\{(\w+)\}/g, (_match, name: string) => String(values?.[name] ?? ""));
  },
}));

const { PublicFooter } = await import("../public-footer");
const { PublicBottomBar } = await import("../public-bottom-bar");
const { BottomBarNav } = await import("../bottom-bar.client");

beforeEach(() => {
  state.pathname = "/";
  state.aiSearch = false;
  state.settings = structuredClone(SITE_DEFAULTS);
});

function withFooter(
  footer: SiteSettings["footer"],
  header: SiteSettings["header"] = { links: [] },
) {
  state.settings = { ...structuredClone(SITE_DEFAULTS), header, footer };
}

describe("PublicFooter: the footer of the public pages (S4-T06)", () => {
  it("shows the catalogue's links, the legal links and the copyright line when nothing is saved", async () => {
    render(await PublicFooter());
    const footer = screen.getByRole("contentinfo");
    const nav = within(footer).getByRole("navigation", { name: "Footer" });
    expect(within(nav).getByRole("heading", { name: "Explore" })).toBeInTheDocument();
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Buy a home", "Rent a home", "New projects", "Contact us", "Post a property"]);
    expect(within(footer).getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(within(footer).getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(within(footer).getByText("© 2026 Find Prop")).toBeInTheDocument();
    expect(within(footer).getByRole("link", { name: "Find Prop, home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("shows the AI search link only while its flag is on", async () => {
    const { unmount } = render(await PublicFooter());
    expect(screen.queryByRole("link", { name: "AI search" })).not.toBeInTheDocument();
    unmount();
    state.aiSearch = true;
    render(await PublicFooter());
    expect(screen.getByRole("link", { name: "AI search" })).toHaveAttribute("href", "/ai-search");
  });

  it("shows what the content team saved: about text, address, phone, email, links and copyright", async () => {
    withFooter(
      {
        about: "A saved sentence about the site.",
        contact: { address: "1 Sample Road", phone: "+91 44 0000 0000", email: "hi@example.org" },
        links: [
          { label: "Help", href: "/contact" },
          { label: "Partner", href: "https://example.org/partner" },
        ],
        copyright: "Saved copyright line",
      },
      { name: "Nest Finder", links: [] },
    );
    render(await PublicFooter());
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByText("A saved sentence about the site.")).toBeInTheDocument();
    expect(within(footer).getByText("1 Sample Road")).toBeInTheDocument();
    expect(within(footer).getByRole("link", { name: "+91 44 0000 0000" })).toHaveAttribute(
      "href",
      "tel:+914400000000",
    );
    expect(within(footer).getByRole("link", { name: "hi@example.org" })).toHaveAttribute(
      "href",
      "mailto:hi@example.org",
    );
    expect(within(footer).getByRole("link", { name: "Help" })).toHaveAttribute("href", "/contact");
    const partner = within(footer).getByRole("link", { name: /Partner/ });
    expect(partner).toHaveAttribute("target", "_blank");
    expect(partner).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(partner).toHaveTextContent("(opens in a new tab)");
    expect(within(footer).getByText("Saved copyright line")).toBeInTheDocument();
    expect(within(footer).getByRole("link", { name: "Nest Finder, home" })).toBeInTheDocument();
  });

  it("leaves out the link column when every saved link is for a route whose flag is off", async () => {
    withFooter({ links: [{ label: "Ask", href: "/ai-search" }] });
    render(await PublicFooter());
    expect(screen.queryByRole("heading", { name: "Explore" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ask" })).not.toBeInTheDocument();
  });
});

describe("BottomBarNav: the phone bottom bar", () => {
  const items = (["home", "search", "post", "saved", "me"] as const).map((key) => ({
    key,
    label: key,
    href: `/${key}`,
    icon: <Icon icon={Home} />,
  }));

  it("shows on the pages the navigation doc lists, with the current item marked", () => {
    state.pathname = "/dashboard";
    render(<BottomBarNav navLabel="Primary" items={items} />);
    const bar = screen.getByRole("navigation", { name: "Primary" });
    expect(within(bar).getAllByRole("link")).toHaveLength(5);
    expect(within(bar).getByRole("link", { name: "me" })).toHaveAttribute("aria-current", "page");
    expect(within(bar).getByRole("link", { name: "home" })).not.toHaveAttribute("aria-current");
  });

  it("holds a block of the bar's height after the footer so the last line is not covered", () => {
    state.pathname = "/";
    const { container } = render(<BottomBarNav navLabel="Primary" items={items} />);
    const spacer = container.querySelector("[aria-hidden=true]");
    expect(spacer).toHaveClass("h-(--bottombar-h)", "md:hidden");
  });

  it.each([
    "/properties/two-bhk-ab12cd",
    "/projects/green-acres",
    "/post-property",
    "/auth",
    "/privacy",
  ])("is not shown on %s", (path) => {
    state.pathname = path;
    const { container } = render(<BottomBarNav navLabel="Primary" items={items} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows on a page where it is normally hidden while an error page there has asked for it", () => {
    state.pathname = "/properties/two-bhk-ab12cd";
    function MissingPage() {
      useRequestBottomBar();
      return null;
    }
    const { rerender } = render(<BottomBarNav navLabel="Primary" items={items} />);
    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
    rerender(
      <>
        <MissingPage />
        <BottomBarNav navLabel="Primary" items={items} />
      </>,
    );
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    rerender(<BottomBarNav navLabel="Primary" items={items} />);
    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
  });

  it("draws nothing on the server, where the pathname may be the rewritten one", () => {
    state.pathname = "/";
    expect(renderToString(<BottomBarNav navLabel="Primary" items={items} />)).toBe("");
  });

  it("is built with the five labelled items and no saved count", async () => {
    render(await PublicBottomBar());
    const bar = screen.getByRole("navigation", { name: "Primary" });
    expect(
      within(bar)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Home", "Search", "Post", "Saved", "Me"]);
    expect(within(bar).getByRole("link", { name: "Saved" })).toHaveAttribute(
      "href",
      "/dashboard?tab=saved",
    );
    expect(within(bar).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  });
});
