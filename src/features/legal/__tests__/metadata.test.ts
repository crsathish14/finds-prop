import { describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";

vi.mock("@/features/seo", () => ({
  NO_INDEX: { robots: { index: false, follow: false } },
  pageMetadata: (input: { title: string; description: string; path: string }) => ({
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
  }),
}));

const { legalMetadata } = await import("../metadata");
const { legalDocument } = await import("../documents");

/** A translator over en.json, enough for the keys the metadata reads. */
const translate = ((key: string) =>
  key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], en)) as never;

describe("legalMetadata: title, description and address of a legal page (S5-T06)", () => {
  it.each([
    ["privacy", "Privacy Policy", "/privacy"],
    ["terms", "Terms of Use", "/terms"],
    ["cookies", "Cookie information", "/cookies"],
  ] as const)(
    "gives %s its own title, a description and its canonical address",
    (kind, title, path) => {
      const metadata = legalMetadata(kind, translate);
      expect(metadata.title).toBe(title);
      expect(String(metadata.description).length).toBeGreaterThan(10);
      expect(metadata.alternates?.canonical).toBe(path);
    },
  );

  it("lets a published page be indexed, and keeps a draft out, by the text it is given (ADR-151)", () => {
    const base = legalDocument("privacy");
    expect(legalMetadata("privacy", translate, { ...base, draft: false }).robots).toBeUndefined();
    expect(legalMetadata("privacy", translate, { ...base, draft: true }).robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it("keeps a draft out of search results", () => {
    expect(legalMetadata("privacy", translate).robots).toEqual({ index: false, follow: false });
  });
});
