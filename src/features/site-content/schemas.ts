import { z } from "zod";
import {
  FOOTER_ABOUT_MAX,
  FOOTER_ADDRESS_MAX,
  FOOTER_COPYRIGHT_MAX,
  FOOTER_LINKS_MAX,
  FOOTER_PHONE_MAX,
  HEADER_LINKS_MAX,
  HERO_EYEBROW_MAX,
  HERO_LAYOUTS,
  HERO_SUBTITLE_MAX,
  HERO_TITLE_MAX,
  LINK_LABEL_MAX,
  LINK_TARGET_MAX,
  LOCALITIES_MAX,
  LOCALITY_LABEL_MAX,
  LOCALITY_RADIUS_MAX_KM,
  SITE_NAME_MAX,
} from "./constants";

/**
 * What the four Site content pages send (S7-T10, FR-ADM-10). A schema message is a key under `validation.*`; the
 * screen looks the words up (ADR-035). Nothing here says who is asking: the admin is the session. A box left empty
 * clears an optional field, so the default shows again (BR-81). The saved value is built from these in
 * `content-service.ts` and checked once more against the shapes the public side reads.
 */
export const tidy = (typed: unknown): unknown =>
  typeof typed === "string" ? typed.trim().replace(/[ \t]+/g, " ") : typed;

const isBlank = (typed: unknown): boolean =>
  typed === undefined || typed === null || (typeof typed === "string" && typed.trim() === "");

/** A blank box is "no value" (null); anything else goes on to the rule. */
const clearable = <T extends z.ZodType>(rule: T) =>
  z.preprocess((typed) => (isBlank(typed) ? null : typed), rule.nullable()).optional();

/** One plain line of text, trimmed. Too long says how long it may be. */
const text = (max: number) =>
  z.preprocess(
    tidy,
    z
      .string()
      .max(max)
      .regex(/^[^\p{C}]*$/u, { error: "validation.invalid" }),
  );

const optionalLine = (max: number) => clearable(text(max));

export const requiredLine = (max: number) =>
  z.preprocess(
    tidy,
    z
      .string()
      .min(1, { error: "validation.required", abort: true })
      .max(max)
      .regex(/^[^\p{C}]*$/u, { error: "validation.invalid" }),
  );

/** Several lines (the footer's about text): the ends are trimmed and the lines kept. */
const optionalParagraph = (max: number) =>
  clearable(
    z.preprocess(
      (typed) => (typeof typed === "string" ? typed.trim() : typed),
      z.string().max(max),
    ),
  );

/**
 * Where a link goes: a page on this site (starting with one slash) or a full https address with something after the
 * slashes. Anything else, such as `javascript:`, `data:` or `//host`, is refused because these values end up in links
 * on every page.
 */
const LINK_TARGET = /^(\/(?![/\\])|https:\/\/[^\s\p{C}])[^\s\p{C}]*$/u;

const linkTarget = z.preprocess(
  tidy,
  z
    .string()
    .min(1, { error: "validation.required", abort: true })
    .max(LINK_TARGET_MAX, { error: "validation.linkTarget" })
    .regex(LINK_TARGET, { error: "validation.linkTarget" }),
);

const navigationLink = z.object({
  label: requiredLine(LINK_LABEL_MAX),
  href: linkTarget,
});

/** The header's button: both boxes empty means no button; one of them empty is a mistake. */
const optionalLink = z
  .preprocess((typed) => {
    if (typeof typed === "object" && typed !== null) {
      const { label, href } = typed as Record<string, unknown>;
      if (isBlank(label) && isBlank(href)) return null;
    }
    return typed;
  }, navigationLink.nullable())
  .optional();

export const headerInputSchema = z.object({
  name: optionalLine(SITE_NAME_MAX),
  links: z.array(navigationLink).max(HEADER_LINKS_MAX),
  cta: optionalLink,
});
export type HeaderInput = z.infer<typeof headerInputSchema>;

export const footerInputSchema = z.object({
  about: optionalParagraph(FOOTER_ABOUT_MAX),
  contact: z
    .object({
      address: optionalLine(FOOTER_ADDRESS_MAX),
      email: clearable(z.preprocess(tidy, z.email({ error: "validation.emailInvalid" }))),
      phone: optionalLine(FOOTER_PHONE_MAX),
    })
    .optional(),
  links: z.array(navigationLink).max(FOOTER_LINKS_MAX),
  copyright: optionalLine(FOOTER_COPYRIGHT_MAX),
});
export type FooterInput = z.infer<typeof footerInputSchema>;

export const heroInputSchema = z.object({
  eyebrow: optionalLine(HERO_EYEBROW_MAX),
  title: requiredLine(HERO_TITLE_MAX),
  subtitle: optionalLine(HERO_SUBTITLE_MAX),
  layout: z.enum(HERO_LAYOUTS, { error: "validation.invalid" }),
});
export type HeroInput = z.infer<typeof heroInputSchema>;

/** "13.0067", " 13.0067 " and 13.0067 are the same number; a blank box is missing, a word is not a number. */
const toNumber = (typed: unknown): unknown => {
  if (typeof typed !== "string") return typed;
  return typed.trim() === "" ? undefined : Number(typed.trim());
};

const numberError = (issue: { input?: unknown }): string =>
  issue.input === undefined ? "validation.required" : "validation.numberInvalid";

/** Six decimals is about a tenth of a metre, more than a search radius of kilometres needs. */
const coordinate = (limit: number) =>
  z
    .preprocess(
      toNumber,
      z
        .number({ error: numberError })
        .min(-limit, { error: "validation.invalid" })
        .max(limit, { error: "validation.invalid" }),
    )
    .transform((value) => Math.round(value * 1e6) / 1e6);

const localityRow = z.object({
  label: requiredLine(LOCALITY_LABEL_MAX),
  lat: coordinate(90),
  lng: coordinate(180),
  radiusKm: z.preprocess(
    toNumber,
    z
      .number({ error: numberError })
      .gt(0, { error: "validation.invalid" })
      .max(LOCALITY_RADIUS_MAX_KM, { error: "validation.invalid" }),
  ),
});

export const homepageInputSchema = z.object({
  showFeatured: z.boolean({ error: "validation.invalid" }),
  showProjectTypes: z.boolean({ error: "validation.invalid" }),
  showDiscovery: z.boolean({ error: "validation.invalid" }),
  showWhyUs: z.boolean({ error: "validation.invalid" }),
  showCta: z.boolean({ error: "validation.invalid" }),
  localities: z
    .array(localityRow)
    .max(LOCALITIES_MAX)
    .superRefine((rows, context) => {
      const seen = new Set<string>();
      rows.forEach((row, index) => {
        const same = row.label.toLowerCase();
        if (seen.has(same)) {
          context.addIssue({
            code: "custom",
            message: "validation.localityLabelTaken",
            path: [index, "label"],
          });
        }
        seen.add(same);
      });
    }),
});
export type HomepageInput = z.infer<typeof homepageInputSchema>;
