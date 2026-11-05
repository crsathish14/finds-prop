// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  list: { status: "ok", projects: [] } as
    { status: "ok"; projects: Record<string, unknown>[] } | { status: "failed" },
  region: {} as { name?: string },
  connection: vi.fn(async () => undefined),
}));

vi.mock("next/server", () => ({ connection: state.connection }));
vi.mock("@/features/site", () => ({
  getTranslate: async () => (key: string) => key,
  getSiteSettings: async () => ({ region: state.region }),
}));
vi.mock("@/lib/public-env", () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
}));
vi.mock("@/features/projects", () => ({
  getProjects: async () => state.list,
  toProjectCard: (project: { slug: string; name: string }) => ({
    href: `/projects/${project.slug}`,
    name: project.name,
    locality: "OMR",
    city: "",
  }),
  ProjectsScreen: (props: {
    status: string;
    regionName?: string;
    browseHref: string;
    cards: unknown[];
  }) => (
    <div
      data-testid="screen"
      data-status={props.status}
      data-region={props.regionName ?? ""}
      data-browse={props.browseHref}
      data-count={props.cards.length}
    />
  ),
}));
vi.mock("@/components/domain/project-card", () => ({
  ProjectCard: (props: { project: { name: string }; priority?: boolean }) => (
    <article data-priority={String(props.priority)}>{props.project.name}</article>
  ),
}));

const { default: ProjectsPage, generateMetadata } = await import("../(public)/projects/page");

beforeEach(() => {
  state.list = { status: "ok", projects: [] };
  state.region = {};
  state.connection.mockClear();
});

describe("the projects page (S4-T09)", () => {
  it("waits for the request, so a failed read is never baked into the page", async () => {
    render(await ProjectsPage());
    expect(state.connection).toHaveBeenCalledTimes(1);
  });

  it("gives the screen the region name and the way to the homes", async () => {
    state.region = { name: "Chennai" };
    render(await ProjectsPage());
    const screenNode = screen.getByTestId("screen");
    expect(screenNode).toHaveAttribute("data-region", "Chennai");
    expect(screenNode).toHaveAttribute("data-browse", "/properties");
    expect(screenNode).toHaveAttribute("data-status", "ok");
    expect(screenNode).toHaveAttribute("data-count", "0");
  });

  it("makes a card for each project", async () => {
    state.list = {
      status: "ok",
      projects: [
        { slug: "a-one", name: "A One" },
        { slug: "b-two", name: "B Two" },
      ],
    };
    render(await ProjectsPage());
    expect(screen.getByTestId("screen")).toHaveAttribute("data-count", "2");
  });

  it("passes a failed read on as failed, with no cards", async () => {
    state.list = { status: "failed" };
    render(await ProjectsPage());
    const screenNode = screen.getByTestId("screen");
    expect(screenNode).toHaveAttribute("data-status", "failed");
    expect(screenNode).toHaveAttribute("data-count", "0");
  });

  it("titles the page from the words", async () => {
    expect(await generateMetadata()).toEqual({ title: "projects.list.metaTitle" });
  });
});
