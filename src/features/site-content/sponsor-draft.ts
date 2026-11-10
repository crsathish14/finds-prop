import { heroCoverage, type HeroCoverage } from "@/lib/sponsor-coverage";
import type { SponsorAd, SponsorFit } from "@/lib/sponsors";
import {
  SPONSORS_MAX,
  SPONSOR_ADVERTISER_MAX,
  SPONSOR_ALT_MAX,
  SPONSOR_HREF_MAX,
  type HeroLayout,
} from "./constants";
import type { SponsorFormat, SponsorImageType } from "./sponsor-rules";
import type { SponsorEditView, SponsorPictureView } from "./sponsor-view";

/**
 * The sponsors the Hero page is working on (S7-T11, FR-ADM-11), and what can be done to them, kept apart from the screen
 * so it can be tested on its own. A draft starts as the stored sponsor; Add, Edit, Delete, Move and Active change the
 * list, and each change is then sent as the whole list (the `saveSponsors` payload). A picture that was chosen but not
 * sent yet is held as the file itself and is put in the bucket when the sponsor is saved (see `sponsor-upload.ts`).
 * Pure: no framework, no storage, so a client island may import it.
 */

/** The four slots by the names the form uses ("phone" is the stored "compact"). */
export const SLOT_KEYS = ["strip-desktop", "strip-phone", "panel-desktop", "panel-phone"] as const;
export type SlotKey = (typeof SLOT_KEYS)[number];

/** The format and the stored device name of a slot key. */
export function slotOf(key: SlotKey): { format: SponsorFormat; device: "desktop" | "compact" } {
  const [format, device] = key.split("-") as [SponsorFormat, "desktop" | "phone"];
  return { format, device: device === "phone" ? "compact" : "desktop" };
}

/** A picture the bucket already holds, as saved. */
export interface StoredDraftPicture {
  kind: "stored";
  path: string;
  /** Where it is shown from (the public address, or the browser's own address for a picture just sent). */
  url: string;
  width: number;
  height: number;
  /** Not known for a picture saved before the editor measured files. */
  bytes: number | null;
  type: SponsorImageType;
}

/** A picture chosen on this page and checked, not sent yet. */
export interface ChosenDraftPicture {
  kind: "chosen";
  file: File;
  /** The browser's own address for the file, for the preview (the page makes it and frees it). */
  url: string;
  width: number;
  height: number;
  bytes: number;
  type: SponsorImageType;
  /** "contain" for a near miss: shown whole on a plain background. */
  fit: Exclude<SponsorFit, "rejected">;
}

export type DraftPicture = StoredDraftPicture | ChosenDraftPicture;

export interface SponsorDraft {
  id: string;
  advertiser: string;
  alt: string;
  href: string;
  active: boolean;
  pictures: Partial<Record<SlotKey, DraftPicture>>;
}

function storedOf(view: SponsorPictureView): StoredDraftPicture {
  return { kind: "stored", ...view };
}

/** The drafts the page opens with: the stored sponsors, in their order. */
export function draftsOf(views: readonly SponsorEditView[]): SponsorDraft[] {
  return views.map((view) => {
    const pictures: SponsorDraft["pictures"] = {};
    for (const format of ["strip", "panel"] as const) {
      const pair = view[format];
      if (!pair) continue;
      pictures[`${format}-desktop`] = storedOf(pair.desktop);
      pictures[`${format}-phone`] = storedOf(pair.compact);
    }
    return {
      id: view.id,
      advertiser: view.advertiser,
      alt: view.alt,
      href: view.href,
      active: view.active,
      pictures,
    };
  });
}

/** A sponsor that has nothing yet (Active starts on). */
export function emptyDraft(id: string): SponsorDraft {
  return { id, advertiser: "", alt: "", href: "", active: true, pictures: {} };
}

/** A format is ready when both its pictures, desktop and phone, are there. */
export function formatReady(draft: SponsorDraft, format: SponsorFormat): boolean {
  return (
    draft.pictures[`${format}-desktop`] !== undefined &&
    draft.pictures[`${format}-phone`] !== undefined
  );
}

export type SponsorStatus = "active" | "inactive" | "needs_images";

/** A sponsor with no ready format is never shown, whatever its switch says. */
export function statusOf(draft: SponsorDraft): SponsorStatus {
  if (!formatReady(draft, "strip") && !formatReady(draft, "panel")) return "needs_images";
  return draft.active ? "active" : "inactive";
}

/** "3 sponsors · 2 active" needs both numbers: a sponsor counts as active when its switch is on. */
export function countsOf(drafts: readonly SponsorDraft[]): { total: number; active: number } {
  return { total: drafts.length, active: drafts.filter((draft) => draft.active).length };
}

/* ---- the changes: each gives back a new list and leaves the old one alone ---- */

export const canAddSponsor = (drafts: readonly SponsorDraft[]): boolean =>
  drafts.length < SPONSORS_MAX;

/** Adds a sponsor at the end (the newest is shown last); refused, with the list unchanged, when the list is full. */
export function withSponsorAdded(
  drafts: readonly SponsorDraft[],
  added: SponsorDraft,
): SponsorDraft[] {
  if (!canAddSponsor(drafts) || drafts.some((draft) => draft.id === added.id)) return [...drafts];
  return [...drafts, added];
}

/** Puts an edited sponsor in the place of the one with the same id. */
export function withSponsorReplaced(
  drafts: readonly SponsorDraft[],
  changed: SponsorDraft,
): SponsorDraft[] {
  return drafts.map((draft) => (draft.id === changed.id ? changed : draft));
}

export function withSponsorRemoved(drafts: readonly SponsorDraft[], id: string): SponsorDraft[] {
  return drafts.filter((draft) => draft.id !== id);
}

/** Swaps a sponsor with its neighbour; the first one cannot go up and the last one cannot go down. */
export function withSponsorMoved(
  drafts: readonly SponsorDraft[],
  id: string,
  direction: "up" | "down",
): SponsorDraft[] {
  const index = drafts.findIndex((draft) => draft.id === id);
  const to = direction === "up" ? index - 1 : index + 1;
  const from = drafts[index];
  const other = drafts[to];
  if (!from || !other) return [...drafts];
  const next = [...drafts];
  next[index] = other;
  next[to] = from;
  return next;
}

export function withSponsorActive(
  drafts: readonly SponsorDraft[],
  id: string,
  active: boolean,
): SponsorDraft[] {
  return drafts.map((draft) => (draft.id === id ? { ...draft, active } : draft));
}

/* ---- what is checked before anything is sent ---- */

export type DraftBox = "advertiser" | "alt" | "href";
export interface DraftProblems {
  /** A message key under `validation.*`, by box. */
  boxes: Partial<Record<DraftBox, string>>;
  /** The slots a format is missing its other half in. */
  slots: Partial<Record<SlotKey, string>>;
}

function isSecureLink(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === "https:" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

/**
 * The problems the server would find in the boxes and in the pairs of pictures, found here first so the person is told
 * at once. The same rules as `sponsorsInputSchema`; the server still decides. Messages are `validation.*` keys.
 */
export function draftProblems(draft: SponsorDraft): DraftProblems {
  const boxes: DraftProblems["boxes"] = {};
  const slots: DraftProblems["slots"] = {};
  const line = (typed: string, limit: number) => {
    const text = typed.trim();
    if (text === "") return "validation.required";
    return Array.from(text).length > limit ? "validation.invalid" : undefined;
  };
  const advertiser = line(draft.advertiser, SPONSOR_ADVERTISER_MAX);
  if (advertiser) boxes.advertiser = advertiser;
  const alt = line(draft.alt, SPONSOR_ALT_MAX);
  if (alt) boxes.alt = alt;
  const href = draft.href.trim();
  if (href === "") boxes.href = "validation.required";
  else if (href.length > SPONSOR_HREF_MAX || !isSecureLink(href))
    boxes.href = "validation.linkInvalid";
  for (const format of ["strip", "panel"] as const) {
    const desktop = `${format}-desktop` as const;
    const phone = `${format}-phone` as const;
    const hasDesktop = draft.pictures[desktop] !== undefined;
    const hasPhone = draft.pictures[phone] !== undefined;
    if (hasDesktop && !hasPhone) slots[phone] = "validation.required";
    if (hasPhone && !hasDesktop) slots[desktop] = "validation.required";
  }
  return { boxes, slots };
}

export const hasProblems = (problems: DraftProblems): boolean =>
  Object.keys(problems.boxes).length + Object.keys(problems.slots).length > 0;

/* ---- what is sent ---- */

export interface SponsorPayload {
  sponsors: {
    id: string;
    advertiser: string;
    alt: string;
    href: string;
    active: boolean;
    strip?: { desktop?: string; compact?: string };
    panel?: { desktop?: string; compact?: string };
  }[];
}

/**
 * The `saveSponsors` input for a list in which every picture is already stored (a chosen one has been put in the bucket
 * and swapped for a stored one first). A format with neither picture is left out; the text is sent as typed and the
 * server tidies it.
 */
export function payloadOf(drafts: readonly SponsorDraft[]): SponsorPayload {
  return {
    sponsors: drafts.map((draft) => {
      const entry: SponsorPayload["sponsors"][number] = {
        id: draft.id,
        advertiser: draft.advertiser,
        alt: draft.alt,
        href: draft.href,
        active: draft.active,
      };
      for (const format of ["strip", "panel"] as const) {
        const desktop = draft.pictures[`${format}-desktop`];
        const compact = draft.pictures[`${format}-phone`];
        if (desktop?.kind !== "stored" && compact?.kind !== "stored") continue;
        entry[format] = {
          ...(desktop?.kind === "stored" ? { desktop: desktop.path } : {}),
          ...(compact?.kind === "stored" ? { compact: compact.path } : {}),
        };
      }
      return entry;
    }),
  };
}

/** Where the server's problems (`sponsors.2.strip.desktop`) belong: the sponsor's id, then the box or slot. */
export function serverProblemsOf(
  drafts: readonly SponsorDraft[],
  fieldPaths: Readonly<Record<string, string>>,
): Record<
  string,
  {
    boxes: Partial<Record<DraftBox, string>>;
    slots: Partial<Record<SlotKey, string>>;
    list?: string;
  }
> {
  const found: Record<
    string,
    {
      boxes: Partial<Record<DraftBox, string>>;
      slots: Partial<Record<SlotKey, string>>;
      list?: string;
    }
  > = {};
  for (const [path, message] of Object.entries(fieldPaths)) {
    const parts = path.split(".");
    if (parts[0] !== "sponsors") continue;
    const draft = drafts[Number(parts[1])];
    if (!draft) continue;
    const entry = (found[draft.id] ??= { boxes: {}, slots: {} });
    const [, , first, second] = parts;
    if (first === "advertiser" || first === "alt" || first === "href") {
      entry.boxes[first] = message;
    } else if (
      (first === "strip" || first === "panel") &&
      (second === "desktop" || second === "compact")
    ) {
      entry.slots[`${first}-${second === "compact" ? "phone" : "desktop"}`] = message;
    } else {
      entry.list = message;
    }
  }
  return found;
}

/* ---- the picture of the hero and the warnings ---- */

/** The sponsors as the public side's selection rules read them, with the addresses the page shows the pictures from. */
export function adsOf(drafts: readonly SponsorDraft[]): SponsorAd[] {
  return drafts.map((draft) => {
    const ad: SponsorAd = {
      id: draft.id,
      active: draft.active,
      placements: ["hero", "results"],
      alt: draft.alt,
      href: draft.href,
    };
    for (const format of ["strip", "panel"] as const) {
      const desktop = draft.pictures[`${format}-desktop`];
      const compact = draft.pictures[`${format}-phone`];
      if (!desktop || !compact) continue;
      ad[format] = {
        desktop: { src: desktop.url, width: desktop.width, height: desktop.height },
        compact: { src: compact.url, width: compact.width, height: compact.height },
      };
    }
    return ad;
  });
}

export interface HeroSponsorView {
  coverage: HeroCoverage;
  /** The banner the preview draws: the first sponsor that can show in this layout. */
  banner: { desktop: string; phone: string; alt: string } | null;
  /** Why there is no banner, for the preview's label. */
  reason?: "no_sponsors" | "none_eligible";
  /** The advertiser of the first sponsor shown, and how many can show. */
  first?: { advertiser: string; shown: number };
}

/** What the live preview and the layout note say, worked out with the public site's own rules (`heroCoverage`). */
export function heroViewOf(drafts: readonly SponsorDraft[], layout: HeroLayout): HeroSponsorView {
  const ads = adsOf(drafts);
  const coverage = heroCoverage(ads, layout);
  const firstId = coverage.shown[0];
  const ad = ads.find((one) => one.id === firstId);
  const creatives = ad?.[coverage.format];
  const draft = drafts.find((one) => one.id === firstId);
  if (!ad || !creatives || !draft) {
    return {
      coverage,
      banner: null,
      reason: drafts.length === 0 ? "no_sponsors" : "none_eligible",
    };
  }
  return {
    coverage,
    banner: { desktop: creatives.desktop.src, phone: creatives.compact.src, alt: ad.alt },
    first: { advertiser: draft.advertiser, shown: coverage.shown.length },
  };
}

export type LayoutWarning =
  | { kind: "none_can_show"; format: SponsorFormat }
  | { kind: "some_missing"; format: SponsorFormat; missing: number; active: number };

/** The warning under the layout cards, or `null` when every active sponsor can show (or none is active). */
export function layoutWarningOf(coverage: HeroCoverage): LayoutWarning | null {
  if (coverage.active > 0 && coverage.shown.length === 0) {
    return { kind: "none_can_show", format: coverage.format };
  }
  if (coverage.missing > 0) {
    return {
      kind: "some_missing",
      format: coverage.format,
      missing: coverage.missing,
      active: coverage.active,
    };
  }
  return null;
}

/** The addresses and files a list holds that the browser made (to free them when the page lets go of them). */
export function chosenFilesOf(draft: SponsorDraft): ChosenDraftPicture[] {
  return Object.values(draft.pictures).filter(
    (picture): picture is ChosenDraftPicture => picture?.kind === "chosen",
  );
}
