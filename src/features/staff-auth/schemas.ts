import { z } from "zod";
import { STAFF_AREAS } from "@/server/auth/staff-sign-in";

/**
 * What the sign-in button sends. Nothing here says who the visitor is or what they may do: the area
 * only picks the sign-in page and the rule applied afterwards, and eligibility is decided from the
 * session the server reads (R-BE-03). `next` is a "go back here" address inside the area.
 */
export const startStaffGoogleSignInSchema = z.object({
  area: z.enum(STAFF_AREAS),
  next: z.string().max(500).optional(),
});

export type StartStaffGoogleSignInInput = z.infer<typeof startStaffGoogleSignInSchema>;
