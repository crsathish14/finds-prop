import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import { isSiteLinkKey, isSiteLinkPath, SITE_LINK_KEYS, SITE_LINKS } from "../site-links";

// The table of pages the assistant may point to. Every path must be a real page of the app and have a label.

const APP = join(process.cwd(), "src", "app", "[locale]");
const GROUPS = ["(public)", "(account)", "(auth)", "(portal)", "(quiet)", ""];

function routeExists(path: string): boolean {
  const route = path.split("?")[0] ?? "";
  const parts = route.split("/").filter((part) => part !== "");
  return GROUPS.some((group) => existsSync(join(APP, group, ...parts, "page.tsx")));
}

describe("site links table", () => {
  it("points every key at a real page of the app", () => {
    for (const key of SITE_LINK_KEYS) expect(routeExists(SITE_LINKS[key].path), key).toBe(true);
  });

  it("uses only internal paths, and a label in en.json for each key", () => {
    for (const key of SITE_LINK_KEYS) {
      const { path, labelKey } = SITE_LINKS[key];
      expect(path.startsWith("/") && !path.startsWith("//"), key).toBe(true);
      const label = labelKey
        .split(".")
        .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en);
      expect(typeof label, key).toBe("string");
    }
  });

  it("knows its own keys and paths and nothing else", () => {
    expect(isSiteLinkKey("post_property")).toBe(true);
    expect(isSiteLinkKey("constructor")).toBe(false);
    expect(isSiteLinkKey("https://evil.example")).toBe(false);
    expect(isSiteLinkPath("/post-property")).toBe(true);
    expect(isSiteLinkPath("/admin/crm")).toBe(false);
    expect(isSiteLinkPath("//evil.example")).toBe(false);
    expect(isSiteLinkPath("https://evil.example/post-property")).toBe(false);
  });
});
