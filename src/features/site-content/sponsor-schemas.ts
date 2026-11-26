import { z } from "zod";
import {
  SPONSORS_MAX,
  SPONSOR_ADVERTISER_MAX,
  SPONSOR_ALT_MAX,
  SPONSOR_HREF_MAX,
} from "./constants";
import { SPONSOR_STYLES } from "@/lib/sponsors";
import { endsBeforeStart } from "@/lib/promotion-dates";
import { optionalLine, promotionDatesInput, requiredLine, tidy } from "./schemas";
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

/** A project's slug, as the projects feature keeps it. Whether such a live project exists is checked by the save. */
const projectSlug = z.preprocess(
  (typed) => (typeof typed === "string" ? typed.trim().toLowerCase() : typed),
  z
    .string()
    .min(1, { error: "validation.required", abort: true })
    .min(2, { error: "validation.invalid" })
    .max(80, { error: "validation.invalid" })
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: "validation.invalid" })
    .optional(),
);

/** The Showcase card's facts (ADR-182). Every box may be left empty here; the ad shows once its required ones are filled. */
const showcase = z
  .object({
    project: optionalLine(60),
    locality: optionalLine(60),
    homes: optionalLine(40),
    price: optionalLine(40),
    size: optionalLine(40),
    possession: optionalLine(40),
    rera: optionalLine(60),
  })
  .optional();

/** The Cinematic banner's words (ADR-182), with the same rule. */
const cinematic = z
  .object({
    eyebrow: optionalLine(30),
    headline: optionalLine(40),
    line: optionalLine(90),
    button: optionalLine(24),
  })
  .optional();

/**
 * Where a click goes decides which box must be filled (ADR-182): another site needs the address, one of our projects
 * needs its slug, and the other box is set aside. Done before the boxes are checked, so a missing one is named with the
 * rest (a rule on the whole sponsor would not run while another box has a problem).
 */
function sortLink(typed: unknown): unknown {
  if (typeof typed !== "object" || typed === null || Array.isArray(typed)) return typed;
  const raw = typed as Record<string, unknown>;
  if (raw.link === "project") {
    return { ...raw, href: undefined, projectSlug: raw.projectSlug ?? "" };
  }
  return { ...raw, href: raw.href ?? "", projectSlug: undefined };
}

const sponsorFields = z.object({
  id: z
    .string()
    .min(1, { error: "validation.required" })
    .max(64, { error: "validation.invalid" })
    .regex(/^[A-Za-z0-9_-]+$/, { error: "validation.invalid" }),
  advertiser: requiredLine(SPONSOR_ADVERTISER_MAX),
  alt: requiredLine(SPONSOR_ALT_MAX),
  /** Where a click goes (ADR-182): another site ("url", as before) or one of our live projects ("project"). */
  link: z.enum(["url", "project"], { error: "validation.invalid" }).default("url"),
  href: secureLink.optional(),
  projectSlug,
  active: z.boolean({ error: "validation.invalid" }),
  strip: format,
  panel: format,
  brand: optionalLine(60),
  photo: picturePath,
  showcase,
  cinematic,
  /** The first and last day the ad runs (ADR-210); empty boxes mean from now and until removed. */
  startsOn: promotionDatesInput.shape.startsOn,
  endsOn: promotionDatesInput.shape.endsOn,
});

const sponsor = z.preprocess(sortLink, sponsorFields);

export const sponsorsInputSchema = z.object({
  /** The hero ad style (ADR-182). Left out, the stored one is kept. */
  style: z.enum(SPONSOR_STYLES, { error: "validation.invalid" }).optional(),
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
        if (endsBeforeStart(item)) {
          context.addIssue({
            code: "custom",
            message: "validation.promotionDatesOrder",
            path: [index, "endsOn"],
          });
        }
        if (item.photo !== undefined && !item.photo.startsWith(`sponsors/${item.id}/`)) {
          context.addIssue({
            code: "custom",
            message: "validation.invalid",
            path: [index, "photo"],
          });
        }
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
