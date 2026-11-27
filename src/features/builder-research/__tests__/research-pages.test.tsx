// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { ResearchPanelView } from "../panel-service";
import type { ResearchPagesActions } from "../research-pages.client";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { ResearchPagesPanel } = await import("../research-pages.client");

const words = en.builderResearch;
const SITE = "https://kadalhomes.example";
const BUILDER = "00000000-0000-4000-b000-000000000001";

const PANEL: ResearchPanelView = {
  builderId: BUILDER,
  name: "Kadal Homes",
  website: SITE,
  site: "kadalhomes.example",
  links: [
    { url: `${SITE}/about`, topic: "about_company" },
    { url: `${SITE}/awards`, topic: "awards_approvals" },
  ],
  websiteProblem: null,
  problems: [{ url: `${SITE}/awards`, at: "2026-11-27T10:00:00Z", problem: "blocked" }],
};

function actions(overrides: Partial<ResearchPagesActions> = {}): ResearchPagesActions {
  return {
    save: vi.fn(async () => ({ ok: true as const, data: { websiteReadable: true } })),
    readAgain: vi.fn(async () => ({ ok: true as const, data: {} })),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UT-builder-research-panel-screen: the pages for the AI assistant", () => {
  it("shows the saved pages, the terms, and a later problem with its date", () => {
    renderWithMessages(<ResearchPagesPanel panel={PANEL} actions={actions()} />);
    expect(screen.getByRole("heading", { name: words.title })).toBeVisible();
    expect(screen.getByLabelText("Page link 1")).toHaveValue(`${SITE}/about`);
    expect(screen.getByText(words.readable)).toBeVisible();
    expect(screen.getByText(words.terms)).toBeVisible();
    expect(
      screen.getByText(`We could not read this page on 27 Nov 2026: ${words.problem.blocked}`),
    ).toBeVisible();
  });

  it("sends all three boxes, and puts a refused page's reason under its box", async () => {
    const save = vi.fn(async () => ({
      ok: false as const,
      code: "VALIDATION" as const,
      fieldErrors: {
        "links.2.url": [
          { key: "builderResearch.problem.notOnSite", values: { site: "kadalhomes.example" } },
        ],
      },
    }));
    renderWithMessages(<ResearchPagesPanel panel={PANEL} actions={actions({ save })} />);
    fireEvent.change(screen.getByLabelText("Page link 3"), {
      target: { value: "https://portal.example/kadal" },
    });
    fireEvent.click(screen.getByRole("button", { name: words.save }));
    await waitFor(() =>
      expect(
        screen.getByText("This page is not on your website. Use a page of kadalhomes.example."),
      ).toBeVisible(),
    );
    expect(save).toHaveBeenCalledWith({
      builderId: BUILDER,
      links: [
        { url: `${SITE}/about`, topic: "about_company" },
        { url: `${SITE}/awards`, topic: "awards_approvals" },
        { url: "https://portal.example/kadal", topic: "" },
      ],
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("warns when the website's home page could not be read after a save", async () => {
    const save = vi.fn(async () => ({ ok: true as const, data: { websiteReadable: false } }));
    renderWithMessages(<ResearchPagesPanel panel={PANEL} actions={actions({ save })} />);
    fireEvent.click(screen.getByRole("button", { name: words.save }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(words.toast.saved));
    expect(screen.getByText(words.websiteWarning)).toBeVisible();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("Read again forgets the saved copies for this builder", async () => {
    const readAgain = vi.fn(async () => ({ ok: true as const, data: {} }));
    renderWithMessages(<ResearchPagesPanel panel={PANEL} actions={actions({ readAgain })} />);
    fireEvent.click(screen.getByRole("button", { name: words.readAgain }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(words.toast.readAgain));
    expect(readAgain).toHaveBeenCalledWith({ builderId: BUILDER });
  });

  it("tells only the admin how long the assistant keeps the pages", () => {
    const { unmount } = renderWithMessages(
      <ResearchPagesPanel panel={PANEL} actions={actions()} />,
    );
    expect(screen.getByText(words.readAgainHint)).toBeVisible();
    expect(screen.queryByText(/7 days/)).toBeNull();
    unmount();
    renderWithMessages(<ResearchPagesPanel panel={PANEL} actions={actions()} viewer="admin" />);
    expect(screen.getByText(words.readAgainHintAdmin)).toBeVisible();
  });

  it("asks for a website first when there is none", () => {
    renderWithMessages(
      <ResearchPagesPanel
        panel={{ ...PANEL, website: null, site: null, links: [], problems: [] }}
        actions={actions()}
      />,
    );
    expect(screen.getByText(words.noWebsite)).toBeVisible();
    expect(screen.getByRole("button", { name: words.save })).toBeDisabled();
  });
});
