import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AccountLayout from "../(account)/layout";
import AuthLayout from "../(auth)/layout";
import PublicLayout from "../(public)/layout";
import { PageLoading } from "../_components/page-loading";

// The header, footer and bars read the site's content and the visitor's cookies; they are stood in
// for by markers so only the layout's own structure is under test.
vi.mock("@/features/site", () => ({
  PublicHeader: () => <header data-testid="header" />,
  PublicFooter: () => <footer data-testid="footer" />,
  PublicBottomBar: () => <nav data-testid="bottom-bar" />,
}));
vi.mock("@/features/compare", () => ({ CompareBar: () => <aside data-testid="compare-bar" /> }));
vi.mock("@/app/[locale]/_components/page-gate", () => ({
  PageGate: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => `[${key}]`,
}));

const WRAPPER = '<div class="flex min-h-dvh flex-col">';

describe("UT-layout-height: the footer starts below the fold while a page streams in (CLS)", () => {
  const layouts = [
    ["public", PublicLayout],
    ["sign-in", AuthLayout],
    ["account", AccountLayout],
  ] as const;

  for (const [name, Layout] of layouts) {
    it(`the ${name} layout keeps the page in a full-height box between the header and the footer`, () => {
      const html = renderToStaticMarkup(
        <Layout>
          <main id="page" />
        </Layout>,
      );
      const header = html.indexOf('data-testid="header"');
      const wrapper = html.indexOf(WRAPPER);
      const page = html.indexOf('<main id="page">');
      const footer = html.indexOf('data-testid="footer"');
      expect(header).toBeGreaterThan(-1);
      expect(wrapper).toBeGreaterThan(header);
      expect(page).toBeGreaterThan(wrapper);
      expect(footer).toBeGreaterThan(page);
      // The page is inside the box, and the box closes before the footer.
      expect(html.slice(wrapper, footer)).toContain("</div>");
    });
  }

  it("the sign-in loading stand-in is a busy, labelled spinner that fills the page", async () => {
    const html = renderToStaticMarkup(await PageLoading());
    expect(html).toContain('id="main"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("flex-1");
    expect(html).toContain("[loading]");
  });
});
