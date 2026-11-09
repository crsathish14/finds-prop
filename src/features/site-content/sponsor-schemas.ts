import { z } from "zod";
import {
  SPONSORS_MAX,
  SPONSOR_ADVERTISER_MAX,
  SPONSOR_ALT_MAX,
  SPONSOR_HREF_MAX,
} from "./constants";
import { requiredLine, tidy } from "./schemas";
import { SPONSOR_SLOTS } from "./sponsor-rules";

/**
 * What the Sponsors save sends (S7-T11, FR-ADM-11): the whole list, in the order it is shown. A message is a key under
 * `validation.*` (ADR-035). A picture is sent as the path of a file the browser has already put in the site's public
 * bucket under `sponsors/<the sponsor's id>/`; its type, weight and size are read from the stored file on the server, so
 * none of them is sent. A format (strip, panel) is both of its pictures or neither: a campaign needs the pair.
 */

/** A web address a banner may open: https, nothing before the host (no user name or password). */
function isSecureLink(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === "https:" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

const secureLink = z.preprocess(
  tidy,
  z
    .string()
    .min(1, { error: "validation.required", abort: true })
    .max(SPONSOR_HREF_MAX, { error: "validation.linkInvalid" })
    .refine(isSecureLink, { error: "validation.linkInvalid" }),
);

/** A stored picture's path: inside the sponsors' folder of the bucket, no way up, only the three allowed endings. */
const PICTURE_PATH =
  /^sponsors\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:webp|jpe?g|png)$/i;

const picturePath = z.preprocess(
  (typed) => (typeof typed === "string" && typed.trim() === "" ? undefined : typed),
  z
    .string()
    .max(200, { error: "validation.invalid" })
    .regex(PICTURE_PATH, { error: "validation.invalid" })
    .refine((path) => !path.includes(".."), { error: "validation.invalid" })
    .optional(),
);

/** A format with neither picture is "no format": a blank or missing one is left out. */
const isBlank = (typed: unknown) =>
  typed === undefined || typed === null || (typeof typed === "string" && typed.trim() === "");

const format = z.preprocess(
  (typed) => {
    if (typed === null) return undefined;
    if (typeof typed === "object") {
      const { desktop, compact } = typed as Record<string, unknown>;
      if (isBlank(desktop) && isBlank(compact)) return undefined;
    }
    return typed;
  },
  z.object({ desktop: picturePath, compact: picturePath }).optional(),
);

const sponsor = z.object({
  id: z
    .string()
    .min(1, { error: "validation.required" })
    .max(64, { error: "validation.invalid" })
    .regex(/^[A-Za-z0-9_-]+$/, { error: "validation.invalid" }),
  advertiser: requiredLine(SPONSOR_ADVERTISER_MAX),
  alt: requiredLine(SPONSOR_ALT_MAX),
  href: secureLink,
  active: z.boolean({ error: "validation.invalid" }),
  strip: format,
  panel: format,
});

export const sponsorsInputSchema = z.object({
  sponsors: z
    .array(sponsor)
    .max(SPONSORS_MAX)
    .superRefine((list, context) => {
      const seen = new Set<string>();
      list.forEach((item, index) => {
        if (seen.has(item.id)) {
          context.addIssue({ code: "custom", message: "validation.invalid", path: [index, "id"] });
        }
        seen.add(item.id);
        for (const name of ["strip", "panel"] as const) {
          const chosen = item[name];
          if (!chosen) continue;
          const folder = `sponsors/${item.id}/`;
          for (const slot of SPONSOR_SLOTS.filter((one) => one.format === name)) {
            const path = chosen[slot.device];
            if (path === undefined) {
              context.addIssue({
                code: "custom",
                message: "validation.required",
                path: [index, name, slot.device],
              });
            } else if (!path.startsWith(folder)) {
              context.addIssue({
                code: "custom",
                message: "validation.invalid",
                path: [index, name, slot.device],
              });
            }
          }
        }
      });
    }),
});

export type SponsorsInput = z.infer<typeof sponsorsInputSchema>;
