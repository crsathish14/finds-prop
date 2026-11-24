import { trackSponsorEventSchema } from "./event-schemas";

/**
 * Counting a view or a click of a paid placement (ADR-194). Anonymous visitors count too (the home page is public),
 * limited to 60 per visitor per minute; one view and one click per visitor, per placement, per day is kept by the
 * database function.
 */
export const trackSponsorEventConfig = {
  name: "trackSponsorEvent",
  input: trackSponsorEventSchema,
  auth: "none" as const,
  rateLimit: { scope: "sponsor_event" as const },
};
