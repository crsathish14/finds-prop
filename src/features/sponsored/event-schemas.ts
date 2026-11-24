import { z } from "zod";
import { SPONSOR_EVENT_KINDS, SPONSOR_EVENT_SLOTS, SPONSOR_KEY_MAX } from "@/lib/sponsor-events";

/** A view or a click of a paid placement, as the browser sends it (ADR-194). */
export const trackSponsorEventSchema = z.object({
  slot: z.enum(SPONSOR_EVENT_SLOTS, { error: "validation.invalid" }),
  key: z.string({ error: "validation.invalid" }).trim().min(1).max(SPONSOR_KEY_MAX),
  kind: z.enum(SPONSOR_EVENT_KINDS, { error: "validation.invalid" }),
});

export type TrackSponsorEventInput = z.infer<typeof trackSponsorEventSchema>;
