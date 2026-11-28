import { describe, expect, it } from "vitest";
import { cityFilterOf, withChosenCity } from "../city-filter";
import { buildSystemPrompt } from "../prompts/system-prompt";

// UT-ai-chosen-city (owner, 28 Nov 2026): a search with no city of its own looks in the city chosen in the site's header,
// and a city the customer names always wins.
describe("withChosenCity", () => {
  it("fills in the chosen city when the customer named none", () => {
    expect(withChosenCity({ city: null, locality: "KK Nagar" }, "Chennai")).toEqual({
      city: "Chennai",
      locality: "KK Nagar",
    });
    expect(withChosenCity({ city: "  ", locality: null }, "Chennai").city).toBe("Chennai");
  });

  it("keeps a city the customer named, whatever was chosen", () => {
    expect(withChosenCity({ city: "Coimbatore" }, "Chennai").city).toBe("Coimbatore");
    expect(cityFilterOf(withChosenCity({ city: "Madurai" }, "Chennai").city)).toBe("madurai");
  });

  it("changes nothing when no city is chosen", () => {
    const filters = { city: null };
    expect(withChosenCity(filters, undefined)).toBe(filters);
  });
});

describe("the prompt's city section", () => {
  const translate = (key: string) => key;

  it("names the chosen city and the other cities, only when the city is known", () => {
    const withCity = buildSystemPrompt({
      translate,
      city: { name: "Chennai", others: ["Madurai"] },
    });
    expect(withCity).toContain("The customer chose Chennai on the site.");
    expect(withCity).toContain("Other cities on");
    expect(withCity).toContain("Madurai");
    expect(withCity).toContain("searches that city only");
    expect(buildSystemPrompt({ translate })).not.toContain("The customer chose");
  });
});
