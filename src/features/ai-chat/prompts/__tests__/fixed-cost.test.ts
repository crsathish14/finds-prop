import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import type { Translate } from "@/lib/format";
import { buildSystemPrompt } from "../system-prompt";

// UT-ai-fixed-cost (ADR-143 section 6.3, ADR-128 section 7): every model call carries the system prompt and the tool
// list, so their size is a cost the customer never sees. This test measures both and holds them under a ceiling, so a
// change that makes them much larger has to say so here. It counts characters, which is what the code can see: a model
// token is about three to four characters of this kind of text, so the estimates are an approximation (the real
// figure is the input token count the provider reports, kept in the usage row and printed in the eval report under
// "Model use"). The reads are stand-ins; nothing here touches a network.

vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/server/env", () => ({
  env: { RATE_LIMIT_HMAC_SECRET: "a-made-up-secret-of-thirty-two-chars!" },
}));
vi.mock("@/server/auth/get-session-view", () => ({ getSessionView: vi.fn() }));
vi.mock("@/features/search", async () => {
  const { DEFAULT_RADIUS_KM, DEFAULT_SORT, DEFAULT_VIEW } =
    await import("@/features/search/schemas");
  const { NEARBY_RADIUS_KM, nearbyHomesToShow, nearbySearchParams, wantsNearby } =
    await import("@/features/search/nearby");
  return {
    getSearchResults: vi.fn(),
    DEFAULT_RADIUS_KM,
    DEFAULT_SORT,
    DEFAULT_VIEW,
    NEARBY_RADIUS_KM,
    nearbyHomesToShow,
    nearbySearchParams,
    wantsNearby,
  };
});
vi.mock("@/features/property", async () => {
  const { amenityList, perSqftRupees } = await import("@/features/property/view");
  return { getProperty: vi.fn(), amenityList, perSqftRupees };
});
vi.mock("@/features/projects", async () => {
  const { bhkSizes, priceOf, TREND_MONTHS } = await import("@/features/projects/view");
  const { isProjectSlug } = await import("@/features/projects/address");
  const { OFFER_TYPES, PRICE_TYPES, PROJECT_STATUSES } =
    await import("@/features/projects/schemas");
  const { visitDateProblem } = await import("@/features/projects/lead-view");
  return {
    getProjects: vi.fn(),
    getProject: vi.fn(),
    bhkSizes,
    priceOf,
    TREND_MONTHS,
    isProjectSlug,
    visitDateProblem,
    OFFER_TYPES,
    PRICE_TYPES,
    PROJECT_STATUSES,
    PROJECT_LIST_LIMIT: 60,
  };
});
vi.mock("@/features/compare", async () => {
  const { COMPARE_MAX, COMPARE_MIN } = await import("@/features/compare/store");
  return { getComparedHomes: vi.fn(), COMPARE_MAX, COMPARE_MIN };
});
vi.mock("../../queries", () => ({
  getLocalityCounts: vi.fn(),
  getBuilderDirectory: vi.fn(),
  getBuilderProfile: vi.fn(),
  ownsHome: vi.fn(),
}));
vi.mock("@/features/builder-research", async () => {
  const { QUESTION_TOPICS } = await import("@/features/builder-research/topics");
  return { QUESTION_TOPICS, researchBuilder: vi.fn() };
});
vi.mock("@/features/careers", async () => {
  const { EMPLOYMENT_TYPES, WORK_MODES } = await import("@/features/careers/constants");
  return { EMPLOYMENT_TYPES, WORK_MODES };
});
vi.mock("../../content-queries", () => ({
  searchContent: vi.fn(),
  readContentItem: vi.fn(),
  searchJobs: vi.fn(),
}));
vi.mock("../../ask-about-button", () => ({ AskAboutButton: () => null }));
vi.mock("../../chat-screen", () => ({
  AiChatScreen: () => null,
  AiChatScreenSkeleton: () => null,
}));

const { AI_CHAT_TOOLS, toolDefinitions } = await import("@/features/ai-chat");

const translate = createTranslator({ locale: "en", messages: en }) as unknown as Translate;

/** The names of the tools the content pull requests added (ADR-143 section 6), to tell their share. */
const CONTENT_TOOL_NAMES = ["search_content", "search_jobs", "get_content_item"];

/**
 * Ceilings in characters, about 10% above what was measured on 21 Nov 2026 (the numbers are in
 * `docs/ai-chat-run-ledger.md`). A change that passes them has made the fixed cost of every message noticeably
 * larger: raise the figure here in the same pull request and say why.
 */
// Raised from 11_200 on 23 Nov 2026 (ADR-174): the conversation section adds about 2,000 characters on purpose.
// Raised from 13_000 on 27 Nov 2026 (ADR-213): the greeting, answer-first and general-knowledge rules add about 1,000
// characters on purpose; measured 13,976.
const PROMPT_CHARACTER_CEILING = 15_000;
// Raised from 25_000 on 23 Nov 2026 (ADR-176): the plain project enquiry is a fourteenth tool.
// Raised from 28_000 on 27 Nov 2026 (ADR-212, owner: quality over cost): research_builder is a sixteenth tool and
// the other tools keep their full descriptions; measured 29,417.
const TOOL_LIST_CHARACTER_CEILING = 32_000;

const definitions = toolDefinitions(AI_CHAT_TOOLS);
const toolListCharacters = JSON.stringify(definitions).length;
const promptCharacters = buildSystemPrompt({ translate }).length;

describe("UT-ai-fixed-cost: what every model call carries", () => {
  it("serves the sixteen tools, three of them the content tools", () => {
    expect(definitions).toHaveLength(16);
    for (const name of CONTENT_TOOL_NAMES) {
      expect(definitions.map((definition) => definition.name)).toContain(name);
    }
  });

  it("keeps the system prompt under its ceiling, with every optional section on", () => {
    const longest = buildSystemPrompt({
      translate,
      placeSearch: true,
      addInjectionReminder: true,
      pageContext: { home: "k3x9a2bd", project: "kadal-vista", compare: ["a1", "b2", "c3"] },
      // The Current search section (ADR-206) with a full home search and the most offers it keeps.
      requirements: {
        search: {
          tool: "search_properties",
          filters: {
            listingType: "sale",
            propertyType: "apartment",
            bhk: 3,
            minPrice: 5_000_000,
            maxPrice: 8_000_000,
            city: "Chennai",
            locality: "Velachery",
            keyword: "lake view",
            label: null,
            preferLocalities: ["Adyar", "Guindy"],
            preferAmenities: ["swimming pool", "gym", "power backup"],
            preferFurnishing: "semi",
            sort: null,
          },
          shown: Array.from({ length: 24 }, (_, index) => `home${index}`),
          total: 120,
          place: false,
        },
        seen: [],
        offered: Array.from({ length: 10 }, (_, index) => `home:k3x9a2b${index}`),
      },
    });
    expect(promptCharacters).toBeLessThan(PROMPT_CHARACTER_CEILING);
    expect(longest.length).toBeLessThan(PROMPT_CHARACTER_CEILING + 2_800);
  });

  it("keeps the tool list under its ceiling", () => {
    expect(toolListCharacters).toBeLessThan(TOOL_LIST_CHARACTER_CEILING);
  });

  it("keeps the three content tools a minor part of the tool list", () => {
    const contentCharacters = JSON.stringify(
      definitions.filter((definition) => CONTENT_TOOL_NAMES.includes(definition.name)),
    ).length;
    expect(contentCharacters).toBeLessThan(toolListCharacters / 2);
  });
});
