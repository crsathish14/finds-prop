// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AI_PRICES } from "@/config/web-search";
import { formatUsd, type Translate } from "@/lib/format";
import messages from "@/i18n/messages/en.json";
import { createTranslator } from "next-intl";
import { renderWithMessages } from "../../../../tests/render-intl";
import { AiAssistantForm } from "../ai-assistant-form.client";
import { estimateCreditLeftUsd, estimateSpendUsd } from "../estimate";
import { aiAssistantInputSchema } from "../schemas";
import { WebAnswersTable } from "../web-answers-table";

// UT-ai-assistant-admin (ADR-218, piece 7): the estimate from our own records, the save's input, and the page's form
// and list. Every number and question here is made up.

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

const translate = createTranslator({ locale: "en", messages }) as unknown as Translate;

describe("UT-ai-assistant-estimate: the spend from our own records", () => {
  it("prices uncached and cached input, output and each web search, rounded to the cent", () => {
    const spend = estimateSpendUsd({
      messages: 1000,
      inputTokens: 20_000_000,
      cachedInputTokens: 5_000_000,
      outputTokens: 2_000_000,
      webSearches: 100,
    });
    // 15 M at $0.10 + 5 M at $0.01 + 2 M at $0.50 + 100 at $0.01 = 1.50 + 0.05 + 1.00 + 1.00
    expect(spend).toBe(3.55);
  });

  it("uses the prices of the one config file, checked on a stated day", () => {
    expect(AI_PRICES.checkedOn).toBe("2026-11-27");
    expect(AI_PRICES.webSearchUsdPerCall).toBe(0.01);
    expect(
      estimateSpendUsd({
        messages: 0,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        webSearches: 0,
      }),
    ).toBe(0);
  });

  it("never prices more cached tokens than input tokens, nor a negative count", () => {
    expect(
      estimateSpendUsd({
        messages: 1,
        inputTokens: 1_000_000,
        cachedInputTokens: 9_000_000,
        outputTokens: -5,
        webSearches: -1,
      }),
    ).toBe(0.01);
  });

  it("gives the credit left, never below zero, and nothing when no credit was typed", () => {
    expect(estimateCreditLeftUsd(20, 3.48)).toBe(16.52);
    expect(estimateCreditLeftUsd(2, 3.48)).toBe(0);
    expect(estimateCreditLeftUsd(null, 3.48)).toBeNull();
  });

  it("writes US dollars with cents", () => {
    expect(formatUsd("en", 16.5)).toBe("$16.50");
  });
});

describe("UT-ai-assistant-input: the save's input", () => {
  it("reads an empty credit as none, and drops a dollar sign, commas and spaces", () => {
    expect(aiAssistantInputSchema.parse({ creditBoughtUsd: "" })).toEqual({
      creditBoughtUsd: null,
    });
    expect(aiAssistantInputSchema.parse({ creditBoughtUsd: " $1,020.50 " })).toEqual({
      creditBoughtUsd: 1020.5,
    });
  });

  it.each(["abc", "-5", "1.234", "100000000"])("refuses %s with the number words", (typed) => {
    const parsed = aiAssistantInputSchema.safeParse({ creditBoughtUsd: typed });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]).toMatchObject({
      path: ["creditBoughtUsd"],
      message: "validation.numberInvalid",
    });
  });

  it("takes no web search switch: FLAG_AI_WEB_SEARCH decides (ADR-218)", () => {
    expect(aiAssistantInputSchema.parse({ webSearch: true, creditBoughtUsd: "" })).toEqual({
      creditBoughtUsd: null,
    });
  });
});

describe("AiAssistantForm: the figures and the save", () => {
  const initial = { creditBoughtUsd: "20.00" };

  it("shows the approved words and the estimates, and no web search switch", () => {
    renderWithMessages(
      <AiAssistantForm initial={initial} spendUsd={3.48} locale="en" save={vi.fn()} />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "AI assistant" })).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.getByText("Estimated spend this month")).toBeInTheDocument();
    expect(screen.getByText("$3.48")).toBeInTheDocument();
    expect(screen.getByLabelText(/Credit bought/u)).toHaveValue("20.00");
    expect(screen.getByText("$16.52")).toBeInTheDocument();
    expect(
      screen.getByText(
        "An estimate from findsprop's own records. Check your OpenAI billing page for the exact balance.",
      ),
    ).toBeInTheDocument();
  });

  it("follows the typed credit, and sends the credit as typed", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, data: {} });
    renderWithMessages(
      <AiAssistantForm initial={initial} spendUsd={3.48} locale="en" save={save} />,
    );
    const credit = screen.getByLabelText(/Credit bought/u);
    await userEvent.clear(credit);
    await userEvent.type(credit, "50");
    expect(screen.getByText("$46.52")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(save).toHaveBeenCalledWith({ creditBoughtUsd: "50" });
  });

  it("shows the server's problem on the credit box", async () => {
    const save = vi.fn().mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { creditBoughtUsd: [{ key: "validation.numberInvalid" }] },
    });
    renderWithMessages(<AiAssistantForm initial={initial} spendUsd={0} locale="en" save={save} />);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Enter a number.")).toBeInTheDocument();
  });
});

describe("WebAnswersTable: the questions answered from the web", () => {
  it("lists the search words, the times used and the last day, most used first as given", () => {
    renderWithMessages(
      <WebAnswersTable
        translate={translate}
        locale="en"
        rows={[
          {
            query: "stamp duty rate Tamil Nadu 2026",
            timesUsed: 14,
            lastUsedAt: "2026-11-26T08:00:00Z",
          },
          { query: "TNRERA complaint process", timesUsed: 6, lastUsedAt: "2026-11-25T08:00:00Z" },
        ]}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Questions answered from the web" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Search words" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Times used" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Last used" })).toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("stamp duty rate Tamil Nadu 2026");
    expect(rows[0]).toHaveTextContent("14");
  });

  it("says so when no question was answered from the web yet", () => {
    renderWithMessages(<WebAnswersTable translate={translate} locale="en" rows={[]} />);
    expect(screen.getByText("No question has been answered from the web yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
