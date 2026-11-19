// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import { renderWithMessages } from "../../../../tests/render-intl";
import type { ContentModulesView } from "../view";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { ContentModulesSection } = await import("../content-modules-section.client");
const { ContentModulePageBar } = await import("../content-module-page-bar.client");

const words = en.admin.contentModules;

/** What the app layout provides, for `rerender` (which renders without the provider that `renderWithMessages` adds). */
function inApp(ui: ReactElement) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <TooltipProvider>{ui}</TooltipProvider>
    </NextIntlClientProvider>
  );
}

const VIEW: ContentModulesView = [
  { module: "blog", live: true, published: 24, drafts: 5 },
  { module: "faq", live: false, published: null, drafts: null },
  { module: "careers", live: true, published: 6, drafts: 1 },
];

const OK: ActionResult<unknown> = { ok: true, data: { key: "content_modules" } };

beforeEach(() => {
  router.refresh.mockClear();
});

describe("the Content modules card, connected (ADR-143)", () => {
  it("sends all three switches with the one that changed, then reads the page again", async () => {
    const save = vi.fn(async () => OK);
    renderWithMessages(<ContentModulesSection modules={VIEW} save={save} />);
    fireEvent.click(screen.getByRole("switch", { name: "Show FAQ on the site" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith({ blog: true, faq: true, careers: true });
    expect(await screen.findByText("FAQ is now live on the site.")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Show FAQ on the site" })).toBeChecked();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("turning off asks first and sends nothing until the question is answered yes", async () => {
    const save = vi.fn(async () => OK);
    renderWithMessages(<ContentModulesSection modules={VIEW} save={save} />);
    fireEvent.click(screen.getByRole("switch", { name: "Show Blog on the site" }));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Hide Blog" }),
    );
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({ blog: false, faq: false, careers: true }),
    );
    expect(await screen.findByText("Blog is now hidden from the site.")).toBeInTheDocument();
  });

  it("keeps the switch as it was and says why when the save fails", async () => {
    const save = vi.fn(async (): Promise<ActionResult<unknown>> => ({
      ok: false,
      code: "FORBIDDEN",
    }));
    renderWithMessages(<ContentModulesSection modules={VIEW} save={save} />);
    fireEvent.click(screen.getByRole("switch", { name: "Show FAQ on the site" }));
    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText("FAQ could not be turned on, so it is still hidden."),
    ).toBeInTheDocument();
    expect(within(alert).getByText(en.errors.FORBIDDEN)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Show FAQ on the site" })).not.toBeChecked();
    // The page is read again, so what shows is what is really saved.
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("says so when the save itself throws", async () => {
    const save = vi.fn(async (): Promise<ActionResult<unknown>> => {
      throw new Error("network");
    });
    renderWithMessages(<ContentModulesSection modules={VIEW} save={save} />);
    fireEvent.click(screen.getByRole("switch", { name: "Show FAQ on the site" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(en.errors.INTERNAL)).toBeInTheDocument();
  });

  it("switches every row off while a save is on its way, and sends only one save", async () => {
    let finish: (result: ActionResult<unknown>) => void = () => undefined;
    const save = vi.fn(() => new Promise<ActionResult<unknown>>((resolve) => (finish = resolve)));
    renderWithMessages(<ContentModulesSection modules={VIEW} save={save} />);
    fireEvent.click(screen.getByRole("switch", { name: "Show FAQ on the site" }));
    for (const toggle of screen.getAllByRole("switch")) expect(toggle).toBeDisabled();
    expect(screen.getByText(words.saving)).toBeInTheDocument();
    finish(OK);
    await screen.findByText("FAQ is now live on the site.");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("takes the new switches from the server when the page is read again", async () => {
    const save = vi.fn(async () => OK);
    const { rerender } = renderWithMessages(<ContentModulesSection modules={VIEW} save={save} />);
    expect(screen.getByRole("switch", { name: "Show FAQ on the site" })).not.toBeChecked();
    rerender(
      inApp(
        <ContentModulesSection
          modules={VIEW.map((row) => (row.module === "faq" ? { ...row, live: true } : row))}
          save={save}
        />,
      ),
    );
    expect(screen.getByRole("switch", { name: "Show FAQ on the site" })).toBeChecked();
  });
});

describe("the switch bar at the top of a module's admin page (ADR-143)", () => {
  it("shows only its own module and saves all three switches", async () => {
    const save = vi.fn(async () => OK);
    renderWithMessages(<ContentModulePageBar module="faq" modules={VIEW} save={save} />);
    expect(screen.getAllByRole("switch")).toHaveLength(1);
    expect(screen.getByRole("switch", { name: "Show FAQ on the site" })).not.toBeChecked();
    expect(screen.getByText(words.status.hidden)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({ blog: true, faq: true, careers: true }),
    );
    expect(await screen.findByText("FAQ is now live on the site.")).toBeInTheDocument();
  });

  it("shows the counts of its module, and dashes when there are none", () => {
    const { rerender } = renderWithMessages(
      <ContentModulePageBar module="careers" modules={VIEW} save={vi.fn()} />,
    );
    expect(screen.getByText("6")).toBeInTheDocument();
    rerender(inApp(<ContentModulePageBar module="faq" modules={VIEW} save={vi.fn()} />));
    expect(screen.getAllByText(words.counts.unavailable)).toHaveLength(2);
  });
});
