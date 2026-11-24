"use client";

import { useTranslations } from "next-intl";
import type { SponsorAdFieldsWords } from "@/components/domain/sponsor-ad-fields";
import type { SponsorFieldsWords } from "@/components/domain/sponsor-fields";
import type { SponsorImageSlotWords } from "@/components/domain/sponsor-image-slot";
import type { SponsorHeroPreviewProps } from "@/components/domain/sponsor-hero-preview";
import type { SponsorsManagerWords } from "@/components/domain/sponsors-manager";
import { SPONSORS_MAX, SPONSOR_IMAGE_MAX_KB, SPONSOR_PHOTO_MAX_KB } from "./constants";
import { PHOTO_RULE } from "./sponsor-rules";

/**
 * Every word of the sponsor manager on the Hero page (S7-T11), read from `admin.siteContent.sponsors` (ADR-035) and given
 * to the parts already translated. The keys are written out in full so the message check can see each one is used.
 */
export function useSponsorWords() {
  const translate = useTranslations("admin.siteContent.sponsors");
  const hero = useTranslations("admin.siteContent.hero");

  const manager = {
    title: translate("title"),
    intro: translate("intro"),
    addLabel: translate("add"),
    caption: translate("caption"),
    note: translate("note"),
    full: translate("full", { maximum: SPONSORS_MAX }),
    columns: {
      advertiser: translate("columns.advertiser"),
      status: translate("columns.status"),
      strip: translate("columns.strip"),
      panel: translate("columns.panel"),
      order: translate("columns.order"),
      actions: translate("columns.actions"),
    },
    words: {
      ready: translate("ready"),
      missing: translate("missing"),
      statuses: {
        active: translate("statuses.active"),
        inactive: translate("statuses.inactive"),
        needsImages: translate("statuses.needsImages"),
      },
      unnamed: translate("unnamed"),
    } satisfies SponsorsManagerWords,
    empty: { title: translate("empty.title"), text: translate("empty.text") },
    edit: translate("edit"),
  };

  const fields: SponsorFieldsWords = {
    advertiser: translate("fields.advertiser"),
    advertiserPlaceholder: translate("fields.advertiserPlaceholder"),
    alt: translate("fields.alt"),
    altPlaceholder: translate("fields.altPlaceholder"),
    altHint: translate("fields.altHint"),
    href: translate("fields.href"),
    hrefPlaceholder: translate("fields.hrefPlaceholder"),
    hrefHint: translate("fields.hrefHint"),
    link: {
      label: translate("fields.linkLabel"),
      project: translate("fields.linkProject"),
      url: translate("fields.linkUrl"),
    },
    project: translate("fields.project"),
    projectPlaceholder: translate("fields.projectPlaceholder"),
    projectHint: translate("fields.projectHint"),
    projectsNone: translate("fields.projectsNone"),
    active: { label: translate("fields.activeLabel"), hint: translate("fields.activeHint") },
    images: {
      title: translate("fields.imagesTitle"),
      text: translate("fields.imagesText", { maximum: SPONSOR_IMAGE_MAX_KB }),
      closing: translate("fields.imagesClosing"),
    },
  };

  const ad: SponsorAdFieldsWords = {
    title: translate("ad.title"),
    text: translate("ad.text"),
    brand: translate("ad.brand"),
    brandHint: translate("ad.brandHint"),
    optional: translate("ad.optional"),
    shownNow: translate("ad.shownNow"),
    showcase: {
      title: translate("ad.showcase.title"),
      text: translate("ad.showcase.text"),
      boxes: {
        project: { label: translate("ad.showcase.project") },
        locality: {
          label: translate("ad.showcase.locality"),
          placeholder: translate("ad.showcase.localityPlaceholder"),
        },
        homes: {
          label: translate("ad.showcase.homes"),
          placeholder: translate("ad.showcase.homesPlaceholder"),
        },
        price: {
          label: translate("ad.showcase.price"),
          placeholder: translate("ad.showcase.pricePlaceholder"),
        },
        size: {
          label: translate("ad.showcase.size"),
          placeholder: translate("ad.showcase.sizePlaceholder"),
        },
        possession: {
          label: translate("ad.showcase.possession"),
          placeholder: translate("ad.showcase.possessionPlaceholder"),
        },
        rera: { label: translate("ad.showcase.rera") },
      },
    },
    cinematic: {
      title: translate("ad.cinematic.title"),
      text: translate("ad.cinematic.text"),
      boxes: {
        headline: { label: translate("ad.cinematic.headline") },
        button: {
          label: translate("ad.cinematic.button"),
          placeholder: translate("ad.cinematic.buttonPlaceholder"),
        },
        eyebrow: {
          label: translate("ad.cinematic.eyebrow"),
          placeholder: translate("ad.cinematic.eyebrowPlaceholder"),
        },
        line: { label: translate("ad.cinematic.line") },
      },
    },
  };

  /** The photo slot of the hero ad (ADR-189). */
  const photo = {
    title: translate("ad.photoTitle"),
    note: translate("ad.photoNote", {
      width: PHOTO_RULE.minimum.width,
      height: PHOTO_RULE.minimum.height,
      maximum: SPONSOR_PHOTO_MAX_KB,
    }),
    sizeText: translate("slot.photoSizeText", { maximum: SPONSOR_PHOTO_MAX_KB }),
  };

  /** The hero ad style switch above the list (ADR-189). */
  const style = {
    label: translate("style.label"),
    showcase: translate("style.showcase"),
    cinematic: translate("style.cinematic"),
    hint: translate("style.hint"),
  };

  const slotWords: SponsorImageSlotWords = {
    dropTitle: translate("slot.dropTitle"),
    dropText: translate("slot.dropText"),
    choose: translate("slot.choose"),
    replace: translate("slot.replace"),
    remove: translate("slot.remove"),
    chooseAnother: translate("slot.chooseAnother"),
    keep: translate("slot.keep"),
    checking: translate("slot.checking"),
    previewAlt: translate("slot.previewAlt"),
  };

  const slotTitles = {
    "strip-desktop": translate("slot.stripDesktop"),
    "strip-phone": translate("slot.stripPhone"),
    "panel-desktop": translate("slot.panelDesktop"),
    "panel-phone": translate("slot.panelPhone"),
  } as const;

  const preview: SponsorHeroPreviewProps["words"] = {
    device: translate("preview.device"),
    desktop: translate("preview.desktop"),
    phone: translate("preview.phone"),
    sponsored: translate("preview.sponsored"),
    layouts: {
      search_desk: hero("layout.searchDesk.label"),
      split: hero("layout.split.label"),
      conversational: hero("layout.conversational.label"),
    },
    reasons: {
      no_sponsors: translate("preview.noSponsors"),
      none_eligible: translate("preview.noneEligible"),
      none_ready: translate("preview.noneReady"),
    },
    none: { title: translate("preview.noneTitle"), text: translate("preview.noneText") },
    phoneNote: translate("preview.phoneNote"),
  };

  /** The sentences that need the page's numbers or names. */
  const say = {
    count: (total: number, active: number) => translate("count", { total, active }),
    moveUp: (name: string) => translate("moveUp", { name }),
    moveDown: (name: string) => translate("moveDown", { name }),
    deleteLabel: (name: string) => translate("deleteLabel", { name }),
    caption: (name: string, count: number) => translate("preview.caption", { name, count }),
    slotNote: (
      shown: { width: number; height: number },
      minimum: { width: number; height: number },
    ) =>
      translate("slot.note", {
        shownWidth: shown.width,
        shownHeight: shown.height,
        width: minimum.width,
        height: minimum.height,
      }),
    details: (width: number, height: number, type: string, weight: number | null) =>
      weight === null
        ? translate("slot.details", { width, height, type })
        : translate("slot.detailsWeight", { width, height, type, weight }),
    layoutLive: (layout: string) => translate("layout.live", { layout }),
    layoutNoneTitle: (layout: string) => translate("layout.noneTitle", { layout }),
    layoutNoneText: (split: boolean, format: string) =>
      split
        ? translate("layout.noneTextSplit", { format })
        : translate("layout.noneTextSearchDesk", { format }),
    layoutSomeTitle: (missing: number, active: number, layout: string) =>
      translate("layout.someTitle", { missing, active, layout }),
    layoutSomeText: (missing: number, layout: string, format: string) =>
      translate("layout.someText", { missing, layout, format }),
    layoutNoneStyle: (style: string) => translate("layout.noneTextStyle", { style }),
    layoutSomeStyleTitle: (missing: number, active: number, style: string) =>
      translate("layout.someTitleStyle", { missing, active, style }),
    layoutSomeStyleText: (missing: number, style: string) =>
      translate("layout.someTextStyle", { missing, style }),
    formatName: (format: "strip" | "panel") =>
      format === "strip" ? translate("layout.formatStrip") : translate("layout.formatPanel"),
    deleteTitle: (name: string) => translate("confirmDelete.title", { name }),
  };

  const drawer = {
    addTitle: translate("drawer.addTitle"),
    editTitle: translate("drawer.editTitle"),
    save: translate("drawer.save"),
    cancel: translate("drawer.cancel"),
    close: translate("drawer.close"),
  };

  const confirmDelete = {
    text: translate("confirmDelete.text"),
    confirm: translate("confirmDelete.confirm"),
    cancel: translate("confirmDelete.cancel"),
  };

  const saved = { title: translate("saved.title"), text: translate("saved.text") };

  /** The line under a slot's picture for each way a picture is refused or needs attention. */
  const slotStatus = {
    fills: translate("slot.fills"),
    nearTitle: translate("slot.nearTitle"),
    near: (width: number, height: number) => translate("slot.nearText", { width, height }),
    typeTitle: translate("slot.typeTitle"),
    typeText: translate("slot.typeText"),
    sizeTitle: (weight: number) => translate("slot.sizeTitle", { weight }),
    sizeText: translate("slot.sizeText", { maximum: SPONSOR_IMAGE_MAX_KB }),
    smallTitle: translate("slot.smallTitle"),
    small: (width: number, height: number, minimumWidth: number, minimumHeight: number) =>
      translate("slot.smallText", { width, height, minimumWidth, minimumHeight }),
    largeTitle: translate("slot.largeTitle"),
    large: (width: number, height: number, maximum: number) =>
      translate("slot.largeText", { width, height, maximum }),
    shapeTitle: translate("slot.shapeTitle"),
    shape: (direction: "taller" | "wider", image: string, slot: string) =>
      translate("slot.shapeText", { direction, image, slot }),
    otherTitle: translate("slot.otherTitle"),
    uploadTitle: translate("slot.uploadTitle"),
    uploadText: translate("slot.uploadText"),
    neededTitle: translate("slot.neededTitle"),
    neededText: translate("slot.neededText"),
  };

  return {
    manager,
    fields,
    ad,
    photo,
    style,
    slotWords,
    slotTitles,
    preview,
    say,
    drawer,
    confirmDelete,
    saved,
    slotStatus,
  };
}
