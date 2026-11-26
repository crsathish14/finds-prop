import { describe, expect, it } from "vitest";
import { agentPath, agentPhoto, isAgentId, toAgentCard, yearsOfExperience } from "../view";
import type { AgentRow } from "../schemas";

const row: AgentRow = {
  id: "00000000-0000-4000-b000-0000000000e1",
  name: "Meena Realty",
  tagline: null,
  description: null,
  logo_path: null,
  logo_url: null,
  established_year: 2012,
  listing_count: 0,
  localities: [],
};
const SUPABASE = "https://example.supabase.test";

describe("agent view", () => {
  it("counts whole years and leaves out a missing or future start", () => {
    expect(yearsOfExperience(2012, 2026)).toBe(14);
    expect(yearsOfExperience(null, 2026)).toBeNull();
    expect(yearsOfExperience(2026, 2026)).toBeNull();
  });

  it("uses the uploaded picture, then an https logo link, else nothing", () => {
    expect(agentPhoto({ ...row, logo_path: `${row.id}/a.png` }, SUPABASE)).toBe(
      `${SUPABASE}/storage/v1/object/public/builder-logos/${row.id}/a.png`,
    );
    expect(agentPhoto({ ...row, logo_url: "https://x.test/a.png" }, SUPABASE)).toBe(
      "https://x.test/a.png",
    );
    expect(agentPhoto({ ...row, logo_url: "http://x.test/a.png" }, SUPABASE)).toBeNull();
    expect(agentPhoto(row, SUPABASE)).toBeNull();
  });

  it("leaves a zero count out of the card and points to the agent's page", () => {
    const card = toAgentCard(row, SUPABASE, 2026);
    expect(card.listings).toBeNull();
    expect(card.years).toBe(14);
    expect(card.profileHref).toBe(agentPath(row.id));
    expect(toAgentCard({ ...row, listing_count: 3 }, SUPABASE, 2026).listings).toBe(3);
  });

  it("accepts only an id shaped like a UUID", () => {
    expect(isAgentId(row.id)).toBe(true);
    expect(isAgentId("kadal-homes")).toBe(false);
  });
});
