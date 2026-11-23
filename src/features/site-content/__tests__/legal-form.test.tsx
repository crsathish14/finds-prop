// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import type { ActionResult } from "@/types/action";
import type { LegalFormProps } from "../legal-form.client";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { LegalForm } = await import("../legal-form.client");

const DOCUMENT = {
  summary: "What we collect.",
  sections: [
    {
      heading: "Who we are",
      blocks: [{ type: "paragraph" as const, text: "We help people find homes." }],
    },
    { heading: "What we collect", blocks: [{ type: "list" as const, items: ["Phone", "Email"] }] },
  ],
};

const ok: ActionResult<unknown> = {
  ok: true,
  data: { kind: "privacy", published: false, version: null },
};

function open(
  options: {
    save?: LegalFormProps["save"];
    initial?: Partial<LegalFormProps["initial"]>;
    kind?: LegalFormProps["kind"];
  } = {},
) {
  const save = options.save ?? vi.fn().mockResolvedValue(ok);
  renderWithMessages(
    <LegalForm
      kind={options.kind ?? "privacy"}
      initial={{
        document: DOCUMENT,
        hasUnpublishedChanges: false,
        published: null,
        ...options.initial,
      }}
      save={save}
    />,
  );
  return save as Mock;
}

beforeEach(() => vi.clearAllMocks());

describe("UT-legal-form-screen: the Privacy Policy and Terms of Use pages (ADR-151, part C)", () => {
  it("opens on the text it was given, under the right heading, with the seven tabs", () => {
    open();
    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Summary" })).toHaveValue("What we collect.");
    expect(
      screen
        .getAllByRole("textbox", { name: "Heading" })
        .map((box) => (box as HTMLInputElement).value),
    ).toEqual(["Who we are", "What we collect"]);
    const nav = screen.getByRole("navigation", { name: "Site content" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toContain("/admin/terms");
    expect(within(nav).getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("is the Terms of Use page when asked", () => {
    open({ kind: "terms" });
    expect(screen.getByRole("heading", { level: 1, name: "Terms of Use" })).toBeInTheDocument();
  });

  it("says what visitors read: the placeholder, the live version, or unpublished changes", () => {
    open();
    expect(screen.getByText(/Visitors see the placeholder text/)).toBeInTheDocument();
  });

  it("says the live version and date when there is one", () => {
    open({ initial: { published: { updated: "2026-11-22", version: "3" } } });
    expect(screen.getByText("Live now: version 3, last updated 2026-11-22.")).toBeInTheDocument();
  });

  it("warns when a saved draft has not been published", () => {
    open({
      initial: { hasUnpublishedChanges: true, published: { updated: "2026-11-22", version: "3" } },
    });
    expect(screen.getByText(/saved changes that visitors cannot see yet/)).toBeInTheDocument();
  });

  it("saves a draft with the anchors made from the headings and says visitors still read the live text", async () => {
    const save = open();
    await userEvent.type(screen.getByRole("textbox", { name: "Summary" }), " Plain words.");
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const sent = save.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sent).toMatchObject({
      kind: "privacy",
      publish: false,
      summary: "What we collect. Plain words.",
    });
    expect((sent["sections"] as { id: string }[]).map((section) => section.id)).toEqual([
      "who-we-are",
      "what-we-collect",
    ]);
    expect(toast.success).toHaveBeenCalledWith("Draft saved", {
      description: "Visitors still read the live version.",
    });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("publishes with its own words and sends publish: true", async () => {
    const save = open();
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0]).toMatchObject({ publish: true });
    expect(toast.success).toHaveBeenCalledWith("Published", {
      description: "The new text is live on the public site.",
    });
  });

  it("never lets a second Publish through while one is pending", async () => {
    let finish: (value: ActionResult<unknown>) => void = () => undefined;
    const save = open({ save: vi.fn(() => new Promise((resolve) => (finish = resolve))) });
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    // The busy button now says Saving and is off, so a second press does nothing.
    const busy = screen.getByRole("button", { name: "Saving" });
    await userEvent.click(busy);
    expect(save).toHaveBeenCalledTimes(1);
    finish(ok);
    await waitFor(() => expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled());
  });

  it("puts the server's problems on the boxes they belong to and says how many", async () => {
    open({
      save: vi.fn().mockResolvedValue({
        ok: false,
        code: "VALIDATION",
        fieldErrors: {
          summary: [{ key: "validation.required" }],
          "sections.1.blocks.0.items": [{ key: "validation.required" }],
        },
      }),
    });
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("2 things need attention")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Summary" })).toHaveAccessibleDescription(
      /This field is required/,
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("says a failure that has no box in a toast", async () => {
    open({ save: vi.fn().mockResolvedValue({ ok: false, code: "INTERNAL" }) });
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it("puts the boxes back to what was loaded when the admin discards", async () => {
    open();
    const summary = screen.getByRole("textbox", { name: "Summary" });
    await userEvent.type(summary, " Extra");
    expect(summary).toHaveValue("What we collect. Extra");
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByRole("textbox", { name: "Summary" })).toHaveValue("What we collect.");
  });
});
