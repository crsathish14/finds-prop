import type { SponsorEventKind, SponsorEventSlot } from "@/lib/sponsor-events";

/**
 * The rule of counting a paid placement (ADR-194), apart from the database so it can be tested alone: only a
 * placement that is live now is counted. A hero ad that is switched off or removed, or a builder no longer picked for
 * that placement, records nothing, so the report cannot be filled with made-up sponsors.
 */

/** What is live now: the active hero ads, and the builders picked for the two builder placements. */
export type LiveSponsors = Record<SponsorEventSlot, ReadonlySet<string>>;

export type SponsorEventRow = {
  slot: SponsorEventSlot;
  key: string;
  kind: SponsorEventKind;
  visitor: string;
};

/** The database: true when the view or click was counted, false for a repeat by that visitor that day. */
export type SponsorEventStore = { record(row: SponsorEventRow): Promise<boolean> };

export function isLiveSponsor(live: LiveSponsors, slot: SponsorEventSlot, key: string): boolean {
  return live[slot].has(key);
}

export async function recordSponsorEvent(
  store: SponsorEventStore,
  live: LiveSponsors,
  row: SponsorEventRow,
): Promise<{ counted: boolean }> {
  if (!isLiveSponsor(live, row.slot, row.key)) return { counted: false };
  return { counted: await store.record(row) };
}
