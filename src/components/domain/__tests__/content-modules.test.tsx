// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { ContentModuleBar } from "../content-module-bar";
import { ContentModulesCard, type ContentModuleRow } from "../content-modules-card";

const words = en.admin.contentModules;

/** What the app layout provides, for `rerender` (which renders without the provider that `renderWithMessages` adds). */
function inApp(ui: ReactElement) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <TooltipProvider>{ui}</TooltipProvider>
    </NextIntlClientProvider>
  );
}

const ROWS: ContentModuleRow[] = [
  { module: "blog", live: true, published: 24, drafts: 5 },
  { module: "faq", live: false, published: 1_380, drafts: 2 },
  { module: "careers", live: true },
];

describe("ContentModuleBar (ADR-143): one module's switch", () => {
  it("names the switch in words, and says Live with a word, not by colour", () => {
    renderWithMessages(<ContentModuleBar module="blog" live onChange={vi.fn()} />);
    const toggle = screen.getByRole("switch", { name: "Show Blog on the site" });
    expect(toggle).toBeChecked();
    expect(screen.getByText(words.status.live)).toBeInTheDocument();
    expect(screen.queryByText(words.status.hidden)).not.toBeInTheDocument();
  });

  it("says Hidden for a module that is off, and what turning it off does under the switch", () => {
    renderWithMessages(<ContentModuleBar module="faq" live={false} onChange={vi.fn()} />);
    expect(screen.getByRole("switch")).not.toBeChecked();
    expect(screen.getByText(words.status.hidden)).toBeInTheDocument();
    expect(screen.getByText(words.faq.effect)).toBeInTheDocument();
  });

  it("shows the counts formatted, and a dash with a spoken reason when they are not given", () => {
    const { rerender } = renderWithMessages(
      <ContentModuleBar module="blog" live published={1_380} drafts={5} onChange={vi.fn()} />,
    );
    expect(screen.getByText("1,380")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.queryByText(words.counts.unavailable)).not.toBeInTheDocument();
    rerender(inApp(<ContentModuleBar module="blog" live published={null} onChange={vi.fn()} />));
    // Two dashes (published and drafts), each with its reason for a screen reader.
    expect(screen.getAllByText(words.counts.unavailable)).toHaveLength(2);
  });

  it("turns on at once, with no question", () => {
    const onChange = vi.fn();
    renderWithMessages(<ContentModuleBar module="faq" live={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("asks before turning off, and changes nothing until the answer is yes", () => {
    const onChange = vi.fn();
    renderWithMessages(<ContentModuleBar module="blog" live onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Hide Blog from the site?")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: words.confirm.cancel }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Hide Blog" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps the switch off while saving and says so", () => {
    renderWithMessages(<ContentModuleBar module="blog" live status="pending" onChange={vi.fn()} />);
    expect(screen.getByRole("switch")).toBeDisabled();
    expect(screen.getByText(words.saving)).toBeInTheDocument();
  });

  it("says what was saved, in words for either state", () => {
    const { rerender } = renderWithMessages(
      <ContentModuleBar module="blog" live status="saved" onChange={vi.fn()} />,
    );
    expect(screen.getByText("Blog is now live on the site.")).toBeInTheDocument();
    rerender(
      inApp(<ContentModuleBar module="blog" live={false} status="saved" onChange={vi.fn()} />),
    );
    expect(screen.getByText("Blog is now hidden from the site.")).toBeInTheDocument();
  });

  it("says a save failed as an alert, with the reason, and which state the module is still in", () => {
    const { rerender } = renderWithMessages(
      <ContentModuleBar
        module="blog"
        live
        status="error"
        problem="You don't have permission to do that."
        onChange={vi.fn()}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(
      within(alert).getByText("Blog could not be turned off, so it is still live."),
    ).toBeInTheDocument();
    expect(within(alert).getByText("You don't have permission to do that.")).toBeInTheDocument();
    rerender(
      inApp(<ContentModuleBar module="blog" live={false} status="error" onChange={vi.fn()} />),
    );
    expect(
      screen.getByText("Blog could not be turned on, so it is still hidden."),
    ).toBeInTheDocument();
  });

  it("can be switched off from outside while another change is saved", () => {
    renderWithMessages(<ContentModuleBar module="blog" live disabled onChange={vi.fn()} />);
    expect(screen.getByRole("switch")).toBeDisabled();
  });

  it("is a bordered bar by default and a plain row when it is not framed", () => {
    const { container, rerender } = renderWithMessages(
      <ContentModuleBar module="blog" live onChange={vi.fn()} />,
    );
    expect(container.querySelector("[data-slot='content-module-bar']")).toHaveClass("border");
    rerender(inApp(<ContentModuleBar module="blog" live framed={false} onChange={vi.fn()} />));
    expect(container.querySelector("[data-slot='content-module-bar']")).not.toHaveClass("border");
  });
});

describe("ContentModulesCard (ADR-143): the dashboard card", () => {
  it("has a row per module in the order given, each with its own switch", () => {
    renderWithMessages(<ContentModulesCard modules={ROWS} onChange={vi.fn()} />);
    expect(screen.getByRole("heading", { name: words.title })).toBeInTheDocument();
    expect(
      screen.getAllByRole("switch").map((toggle) => toggle.getAttribute("aria-checked")),
    ).toEqual(["true", "false", "true"]);
    expect(screen.getByRole("switch", { name: "Show FAQ on the site" })).toBeInTheDocument();
    expect(screen.getByText(words.careers.effect)).toBeInTheDocument();
  });

  it("tells the page which module changed and to what", () => {
    const onChange = vi.fn();
    renderWithMessages(<ContentModulesCard modules={ROWS} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch", { name: "Show FAQ on the site" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("faq", true);
  });

  it("asks before hiding a module from the card too", () => {
    const onChange = vi.fn();
    renderWithMessages(<ContentModulesCard modules={ROWS} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch", { name: "Show Careers on the site" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Hide Careers" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("careers", false);
  });

  it("switches every row off while one is being saved, because one save writes all three", () => {
    renderWithMessages(
      <ContentModulesCard
        onChange={vi.fn()}
        modules={ROWS.map((row) => (row.module === "faq" ? { ...row, status: "pending" } : row))}
      />,
    );
    for (const toggle of screen.getAllByRole("switch")) expect(toggle).toBeDisabled();
  });

  it("shows dashes for counts it was not given, in the row that lacks them only", () => {
    renderWithMessages(<ContentModulesCard modules={ROWS} onChange={vi.fn()} />);
    expect(screen.getByText("1,380")).toBeInTheDocument();
    expect(screen.getAllByText(words.counts.unavailable)).toHaveLength(2);
  });
});
