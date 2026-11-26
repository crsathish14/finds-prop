// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SITE_DEFAULTS } from "@/features/site/defaults";
import { mergeSiteSettings } from "@/features/site/merge";
import { createLogger } from "@/server/logger";
import { renderWithMessages } from "../../../../tests/render-intl";
import { saveProjectPrimeContent, type ContentStore } from "../content-service";
import { ProjectPrimeForm } from "../project-prime-form.client";
import { projectPrimeInputSchema } from "../schemas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const quiet = createLogger({}, { write: () => undefined });

function fakeStore() {
  const writes: { key: string; value: Record<string, unknown> }[] = [];
  const store: ContentStore = {
    write: (key, value) => {
      writes.push({ key, value });
      return Promise.resolve();
    },
    readBounds: () => Promise.resolve(SITE_DEFAULTS.region.bounds),
  };
  return { store, writes };
}

describe("UT-project-prime-setting: the Prime amounts the super admin saves (ADR-208)", () => {
  it("reads empty boxes as null and drops commas and spaces between digits", () => {
    expect(
      projectPrimeInputSchema.parse({
        ratePerSqft: "",
        totalPrice: "1,50,00,000",
        rentPerMonth: " 60 000 ",
        rentPerSqftMonth: null,
      }),
    ).toEqual({
      ratePerSqft: null,
      totalPrice: 15_000_000,
      rentPerMonth: 60_000,
      rentPerSqftMonth: null,
    });
  });

  it.each(["abc", "12.5", "-5", "0", "1000000000000"])(
    "refuses %s with the whole rupees words",
    (typed) => {
      const parsed = projectPrimeInputSchema.safeParse({
        ratePerSqft: typed,
        totalPrice: null,
        rentPerMonth: null,
        rentPerSqftMonth: null,
      });
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]).toMatchObject({
        path: ["ratePerSqft"],
        message: "validation.wholeRupees",
      });
    },
  );

  it("stores all four amounts, a cleared one as null, so the built-in amount does not come back", async () => {
    const { store, writes } = fakeStore();
    await saveProjectPrimeContent(store, {
      ratePerSqft: 12_000,
      totalPrice: null,
      rentPerMonth: 60_000,
      rentPerSqftMonth: null,
    });
    expect(writes).toEqual([
      {
        key: "project_prime",
        value: {
          ratePerSqft: 12_000,
          totalPrice: null,
          rentPerMonth: 60_000,
          rentPerSqftMonth: null,
        },
      },
    ]);
    const merged = mergeSiteSettings([{ key: "project_prime", value: writes[0]?.value }], quiet);
    expect(merged.project_prime.totalPrice).toBeNull();
    expect(merged.project_prime.ratePerSqft).toBe(12_000);
  });

  it("uses the owner's amounts until a save, and ignores a stored row that does not fit", () => {
    expect(mergeSiteSettings([], quiet).project_prime).toEqual(SITE_DEFAULTS.project_prime);
    const bad = mergeSiteSettings([{ key: "project_prime", value: { totalPrice: "lots" } }], quiet);
    expect(bad.project_prime.totalPrice).toBe(15_000_000);
  });
});

describe("ProjectPrimeForm: the Prime projects page (ADR-208)", () => {
  const initial = {
    ratePerSqft: "",
    totalPrice: "15000000",
    rentPerMonth: "60000",
    rentPerSqftMonth: "",
  };

  it("shows the four boxes with what is in use today", () => {
    renderWithMessages(<ProjectPrimeForm initial={initial} save={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Prime projects" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Total price \(basic or all inclusive\)/u)).toHaveValue(
      "15000000",
    );
    expect(screen.getByLabelText(/Rate per sq ft \(sale\)/u)).toHaveValue("");
    expect(screen.getByLabelText(/^Rent per month/u)).toHaveValue("60000");
    expect(screen.getByLabelText(/Rent per sq ft per month/u)).toHaveValue("");
  });

  it("sends what is typed, and shows the server's problem on its box", async () => {
    const save = vi.fn().mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { ratePerSqft: [{ key: "validation.wholeRupees" }] },
    });
    renderWithMessages(<ProjectPrimeForm initial={initial} save={save} />);
    await userEvent.type(screen.getByLabelText(/Rate per sq ft \(sale\)/u), "12k");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(save).toHaveBeenCalledWith({ ...initial, ratePerSqft: "12k" });
    expect(
      await screen.findByText("Enter a whole number of rupees, or leave it empty."),
    ).toBeInTheDocument();
  });
});
