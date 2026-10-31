import { describe, expect, it } from "vitest";
import { cn } from "../cn";

describe("cn", () => {
  it("joins names and drops falsy values", () => {
    expect(cn("a", false, undefined, null, "b", { visible: true, hidden: false })).toBe(
      "a b visible",
    );
  });

  it("lets the last conflicting class win", () => {
    expect(cn("p-4", "p-6")).toBe("p-6");
    expect(cn("bg-surface", "bg-canvas")).toBe("bg-canvas");
  });

  it("treats our type styles as sizes, not colours", () => {
    expect(cn("text-h2", "text-h1")).toBe("text-h1");
    expect(cn("text-h1", "text-ink")).toBe("text-h1 text-ink");
    expect(cn("text-ink", "text-h1")).toBe("text-ink text-h1");
    expect(cn("text-price", "text-price-lg")).toBe("text-price-lg");
  });

  it("treats our colours as colours", () => {
    expect(cn("text-ink", "text-muted")).toBe("text-muted");
    expect(cn("text-primary", "text-cta-text")).toBe("text-cta-text");
  });

  it("merges our radius and shadow names", () => {
    expect(cn("rounded-md", "rounded-pill")).toBe("rounded-pill");
    expect(cn("shadow-card", "shadow-pop")).toBe("shadow-pop");
  });
});
