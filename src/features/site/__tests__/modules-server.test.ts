import { beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_DEFAULTS } from "../defaults";

vi.mock("server-only", () => ({}));
const notFound = vi.fn(() => {
  throw new Error("NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));
const getSiteSettings = vi.fn();
vi.mock("../queries", () => ({ getSiteSettings: () => getSiteSettings() }));

describe("UT-content-modules-server: a page of a switched-off module is not found (ADR-143)", () => {
  beforeEach(() => {
    notFound.mockClear();
    getSiteSettings.mockReset();
  });

  it("lets the page render when the module is on", async () => {
    getSiteSettings.mockResolvedValue(SITE_DEFAULTS);
    const { requireContentModule } = await import("../modules.server");
    await expect(requireContentModule("blog")).resolves.toBeUndefined();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("answers not found for a module that is off, and only for that one", async () => {
    getSiteSettings.mockResolvedValue({
      ...SITE_DEFAULTS,
      content_modules: { blog: false, faq: true, careers: true },
    });
    const { getContentModuleOn, requireContentModule } = await import("../modules.server");
    await expect(requireContentModule("blog")).rejects.toThrow("NOT_FOUND");
    await expect(requireContentModule("faq")).resolves.toBeUndefined();
    expect(await getContentModuleOn("careers")).toBe(true);
    expect(await getContentModuleOn("blog")).toBe(false);
  });
});
