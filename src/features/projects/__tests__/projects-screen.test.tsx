// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { ProjectsScreen } = await import("../projects-screen");
const { ProjectsSkeleton } = await import("../projects-skeleton");

const words = en.projects.list;
const cards = [
  <article key="a">Kadal Vista</article>,
  <article key="b">Marina Heights</article>,
  <article key="c">Olive Court</article>,
];

describe("ProjectsScreen: the projects page (S4-T09)", () => {
  it("has the breadcrumb, the New launches line, the heading with the region and the line under it", () => {
    renderWithMessages(
      <ProjectsScreen status="ok" cards={cards} regionName="Chennai" browseHref="/properties" />,
    );
    const crumbs = screen.getByRole("navigation", { name: words.crumb.nav });
    // Home appears twice: the back link of a narrow screen and the first step of the trail.
    for (const link of within(crumbs).getAllByRole("link", { name: words.crumb.home })) {
      expect(link).toHaveAttribute("href", "/");
    }
    expect(within(crumbs).getByText(words.crumb.projects)).toHaveAttribute("aria-current", "page");
    expect(screen.getByText(words.overline)).toBeInTheDocument();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Projects in Chennai");
    expect(within(heading).getByText("Chennai").tagName).toBe("EM");
    expect(screen.getByText(words.sub)).toBeInTheDocument();
  });

  it("does not name a city the site content did not give", () => {
    renderWithMessages(<ProjectsScreen status="ok" cards={cards} browseHref="/properties" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(words.title);
    expect(screen.queryByText(/Chennai/)).toBeNull();
  });

  it("treats a blank region name as none", () => {
    renderWithMessages(
      <ProjectsScreen status="ok" cards={cards} regionName="   " browseHref="/properties" />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(words.title);
  });

  it("draws every card in a labelled section", () => {
    renderWithMessages(<ProjectsScreen status="ok" cards={cards} browseHref="/properties" />);
    const section = screen.getByRole("region", { name: words.listLabel });
    expect(within(section).getAllByRole("article")).toHaveLength(3);
  });

  it("says new projects are coming soon, with one way on, when there are none", () => {
    renderWithMessages(<ProjectsScreen status="ok" cards={[]} browseHref="/properties" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: words.empty.title })).toBeInTheDocument();
    expect(screen.getByText(words.empty.body)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: words.empty.browse })).toHaveAttribute(
      "href",
      "/properties",
    );
    expect(screen.queryByRole("region", { name: words.listLabel })).toBeNull();
  });

  it("says the projects could not be loaded, with Try again, when the read failed", () => {
    renderWithMessages(<ProjectsScreen status="failed" cards={[]} browseHref="/properties" />);
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText(words.error.title)).toBeInTheDocument();
    expect(within(alert).getByText(words.error.body)).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: words.error.retry })).toBeInTheDocument();
    // A failure is not "coming soon".
    expect(screen.queryByText(words.empty.title)).toBeNull();
  });

  it("lets the Design Lab choose the heading level", () => {
    renderWithMessages(
      <ProjectsScreen
        status="ok"
        cards={cards}
        browseHref="/properties"
        titleAs="h2"
        titleId="lab-title"
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: words.title })).toHaveAttribute(
      "id",
      "lab-title",
    );
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });
});

describe("ProjectsSkeleton: the page while its projects load", () => {
  it("draws the outline as lines and three loading cards, hidden from screen readers", () => {
    const { container } = renderWithMessages(<ProjectsSkeleton />);
    expect(container.querySelectorAll("[data-slot=project-card-skeleton]")).toHaveLength(3);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
