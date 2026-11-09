// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { ProjectLeadsActions } from "../project-leads-panel.client";
import type { LeadView } from "../view";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { BuilderLeadsBoard } = await import("../builder-leads-board.client");

const words = en.builderPortal.leads;

const lead = (id: string): LeadView => ({
  id,
  projectId: "00000000-0000-4000-b000-000000000001",
  projectName: "Kadal Vista",
  kind: "enquiry",
  name: `Person ${id}`,
  phone: "9841055512",
  email: null,
  message: null,
  visitDate: null,
  status: "new",
  createdAt: "2026-10-28T05:12:00+00:00",
});

function open(given: Partial<ProjectLeadsActions> = {}) {
  const actions: ProjectLeadsActions = {
    setStatus: vi.fn(async () => ({
      ok: true as const,
      data: { leadId: "1", projectId: "p1", status: "contacted" as const },
    })),
    loadMore: vi.fn(),
    ...given,
  };
  renderWithMessages(
    <BuilderLeadsBoard
      page={{ leads: [lead("1"), lead("2")], total: 2, nextCursor: null }}
      actions={actions}
    />,
  );
  return actions;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BuilderLeadsBoard: the builder's Leads page (S7-T03)", () => {
  it("shows the heading and the line under it, a row for each lead, and no tabs", () => {
    open();
    expect(screen.getByRole("heading", { level: 1, name: words.metaTitle })).toBeVisible();
    expect(screen.getByText(words.intro)).toBeVisible();
    expect(screen.getByRole("table")).toBeVisible();
    expect(screen.getByText("Person 1")).toBeVisible();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("saves a state through the builder's own action as soon as it is chosen", async () => {
    const actions = open();
    fireEvent.change(screen.getByRole("combobox", { name: "Status for Person 1" }), {
      target: { value: "contacted" },
    });
    await waitFor(() =>
      expect(actions.setStatus).toHaveBeenCalledWith({ leadId: "1", status: "contacted" }),
    );
  });
});
