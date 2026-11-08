import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import { EMPTY_BUILDER_VALUES, initialsOf, isFormField, lastSignInText, valuesOf } from "../form";
import type { BuilderRowView } from "../view";

const translate = (key: string, values?: Record<string, string | number>) => {
  const found = key
    .split(".")
    .reduce<unknown>((tree, part) => (tree as Record<string, unknown> | undefined)?.[part], en);
  const text = typeof found === "string" ? found : key;
  return text.replace(
    /\{(\w+)(?:, plural, one \{([^}]*)\} other \{([^}]*)\})?\}/g,
    (_all, name, one, other) => {
      const value = values?.[name];
      if (one === undefined) return String(value);
      return (value === 1 ? one : other).replace("#", String(value));
    },
  );
};

const NOW = Date.parse("2026-11-08T10:00:00+05:30");

describe("UT-builder-form: helpers of the Builders page (S7-T05)", () => {
  it("opens the invite form empty, as a builder", () => {
    expect(EMPTY_BUILDER_VALUES).toEqual({
      name: "",
      email: "",
      kind: "builder",
      contactPerson: "",
      phone: "",
      logoUrl: "",
      website: "",
      description: "",
    });
  });

  it("opens the edit form with what is on record and a blank box for anything not given", () => {
    const row: BuilderRowView = {
      id: "b1",
      name: "Kadal Homes",
      email: "sales@kadalhomes.example",
      kind: "agent",
      status: "active",
      contactPerson: null,
      phone: "+919841055512",
      logoUrl: null,
      website: "https://kadalhomes.example",
      description: null,
      projects: 1,
      leads: 2,
      invitedAt: null,
      lastSignInAt: null,
    };
    expect(valuesOf(row)).toEqual({
      name: "Kadal Homes",
      email: "sales@kadalhomes.example",
      kind: "agent",
      contactPerson: "",
      phone: "+919841055512",
      logoUrl: "",
      website: "https://kadalhomes.example",
      description: "",
    });
  });

  it("knows which answers belong to a box", () => {
    expect(isFormField("email")).toBe(true);
    expect(isFormField("builderId")).toBe(false);
  });

  it("makes two capital letters from the first two words, whatever the spacing", () => {
    expect(initialsOf("Kadal Homes")).toBe("KH");
    expect(initialsOf("  nila   habitats  and more")).toBe("NH");
    expect(initialsOf("Arivu")).toBe("A");
    expect(initialsOf("")).toBe("");
  });

  it("says when someone last signed in: never, today with the time, then days and months", () => {
    expect(lastSignInText(translate, "en", null, NOW)).toBe("Hasn't signed in yet");
    expect(lastSignInText(translate, "en", "2026-11-08T04:10:00+00:00", NOW)).toMatch(/^Today, /);
    expect(lastSignInText(translate, "en", "2026-11-07T10:00:00+00:00", NOW)).toBe("1 day ago");
    expect(lastSignInText(translate, "en", "2026-11-05T04:00:00+00:00", NOW)).toBe("3 days ago");
    expect(lastSignInText(translate, "en", "2026-09-01T10:00:00+00:00", NOW)).toBe("2 months ago");
  });
});
