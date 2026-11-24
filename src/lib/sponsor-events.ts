/**
 * Counting the paid placements for the sponsor report (ADR-194): what the browser sends when a placement is seen or
 * clicked. Shared by the counting part on the page and the server action that records it; nothing here reaches the
 * database.
 */

/** The three paid placements: the hero ad, the Featured project card in the results, the Developer spotlight. */
export const SPONSOR_EVENT_SLOTS = ["hero", "results", "spotlight"] as const;
export type SponsorEventSlot = (typeof SPONSOR_EVENT_SLOTS)[number];

/** A placement is counted when it is seen and when one of its links is followed. */
export const SPONSOR_EVENT_KINDS = ["view", "click"] as const;
export type SponsorEventKind = (typeof SPONSOR_EVENT_KINDS)[number];

/** The sponsor of a placement: the hero ad's id, or the builder's id for the two builder placements. */
export const SPONSOR_KEY_MAX = 80;

export type SponsorEventInput = { slot: SponsorEventSlot; key: string; kind: SponsorEventKind };

/** The server action that records a view or a click, handed to the counting part by the page. */
export type SponsorRecorder = (input: SponsorEventInput) => Promise<unknown>;

/** A placement counts as seen when at least half of it has been on screen for this long (the usual ad measure). */
export const SPONSOR_VIEW_MS = 1000;
export const SPONSOR_VIEW_SHARE = 0.5;
