"use client";

import { Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { SiteContentLayout } from "@/components/domain/site-content-layout";
import { SiteHeroFields, type SiteHeroValues } from "@/components/domain/site-hero-fields";
import {
  SponsorHeroPreview,
  type SponsorHeroLayout,
  type SponsorHeroPreviewProps,
} from "@/components/domain/sponsor-hero-preview";
import {
  SponsorsManager,
  type SponsorRow,
  type SponsorsManagerWords,
} from "@/components/domain/sponsors-manager";
import { Alert } from "@/components/patterns/alert";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { heroCoverage } from "@/lib/sponsor-coverage";
import type { SponsorAd } from "@/lib/sponsors";
import { SAMPLE_AD_A, SAMPLE_AD_B, SAMPLE_AD_C } from "@/lib/sponsors.fixtures";
import { Specimen } from "../frame";
import { SaveBar, tabs } from "./admin-site-content-demos";
import { HERO_WORDS, STANDARD_HEADLINE } from "./admin-site-hero-homepage-demos";

/**
 * The sponsors section of the Hero page in its states (S7-T11, part B2): the list of sponsors with its order arrows,
 * the hero preview with the banner in it, and the whole Hero page with both. Plain English text; nothing here is
 * sent anywhere. The pictures are the approved UX stand-ins. The words that are not in the approved UX file are listed
 * in ADR-109 for the owner to confirm.
 */

type Sample = { ad: SponsorAd; name: string };

function stripOnly(ad: SponsorAd): SponsorAd {
  return {
    id: ad.id,
    active: ad.active,
    placements: ad.placements,
    alt: ad.alt,
    href: ad.href,
    ...(ad.strip ? { strip: ad.strip } : {}),
  };
}

function noImages(ad: SponsorAd): SponsorAd {
  return { id: ad.id, active: ad.active, placements: ad.placements, alt: ad.alt, href: ad.href };
}

const DEVELOPER: Sample = { ad: SAMPLE_AD_A, name: "Sample Developer" };
const BUILDER: Sample = { ad: stripOnly(SAMPLE_AD_B), name: "Sample Builder" };
const FINANCE: Sample = { ad: noImages(SAMPLE_AD_C), name: "Sample Finance" };
const THREE: Sample[] = [DEVELOPER, BUILDER, FINANCE];

const WORDS: SponsorsManagerWords = {
  ready: "Ready",
  missing: "Missing",
  statuses: { active: "Active", inactive: "Inactive", needsImages: "Needs images" },
  unnamed: "Unnamed sponsor",
};

const COLUMNS = {
  advertiser: "Advertiser",
  status: "Status",
  strip: "Strip",
  panel: "Panel",
  order: "Order",
  actions: "Actions",
};

const NOTHING = () => undefined;

/** The list with one sponsor swapped with its neighbour, as the arrows do. */
function moved(list: Sample[], id: string, direction: "up" | "down"): Sample[] {
  const index = list.findIndex(({ ad }) => ad.id === id);
  const to = direction === "up" ? index - 1 : index + 1;
  const from = list[index];
  const other = list[to];
  if (!from || !other) return list;
  const next = [...list];
  next[index] = other;
  next[to] = from;
  return next;
}

function rowsOf(
  samples: Sample[],
  actions: { onDelete?: (id: string) => void; pending?: boolean } = {},
): SponsorRow[] {
  return samples.map(({ ad, name }) => {
    const label = name || WORDS.unnamed;
    return {
      id: ad.id,
      advertiser: name,
      status: !ad.strip && !ad.panel ? "needs_images" : ad.active ? "active" : "inactive",
      strip: ad.strip !== undefined,
      panel: ad.panel !== undefined,
      moveUpLabel: `Move ${label} up`,
      moveDownLabel: `Move ${label} down`,
      editLabel: "Edit",
      editFor: label,
      onEdit: NOTHING,
      deleteLabel: `Delete ${label}`,
      onDelete: () => actions.onDelete?.(ad.id),
      ...(actions.pending ? { pending: true } : {}),
    };
  });
}

function countText(samples: Sample[]): string {
  const active = samples.filter(({ ad }) => ad.active).length;
  return `${samples.length} ${samples.length === 1 ? "sponsor" : "sponsors"} · ${active} active`;
}

const MANAGER_TEXT = {
  title: "Sponsors",
  intro: "Shown in this order, one after another.",
  addLabel: "Add sponsor",
  columns: COLUMNS,
  caption: "Sponsors",
  note: "A campaign needs both the desktop and the phone image of a format.",
  words: WORDS,
  empty: {
    title: "No sponsors yet",
    text: "The homepage shows no banner and no empty space. Add a sponsor to show a banner under the search (Search Desk) or beside it (Split).",
  },
};

/** The sponsors as the page keeps them: moved with the arrows, deleted after the question. */
function ManagerState({
  initial,
  saving = false,
  headingLevel = "h3",
}: {
  initial: Sample[];
  saving?: boolean;
  headingLevel?: "h2" | "h3";
}) {
  const [samples, setSamples] = useState(initial);
  const [deleting, setDeleting] = useState<string | null>(null);
  const target = samples.find(({ ad }) => ad.id === deleting);
  const move = (id: string, direction: "up" | "down") =>
    setSamples((current) => moved(current, id, direction));
  return (
    <div className="w-full">
      <SponsorsManager
        {...MANAGER_TEXT}
        headingLevel={headingLevel}
        addDisabled={saving}
        rows={rowsOf(samples, { onDelete: setDeleting, pending: saving })}
        countText={countText(samples)}
        onAdd={NOTHING}
        onMove={move}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        icon={<Icon icon={Trash2} size="lg" />}
        title={`Delete ${target?.name ?? "this sponsor"}?`}
        description="This removes the sponsor and its images. Visitors stop seeing it straight away. This can't be undone."
        confirmLabel="Delete sponsor"
        cancelLabel="Cancel"
        onConfirm={() => {
          setSamples((current) => current.filter(({ ad }) => ad.id !== deleting));
          setDeleting(null);
        }}
      />
    </div>
  );
}

const LONG_NAME =
  "The Very Long Named Advertiser and Associates of Greater Chennai Properties and Land Holdings Private Limited";

export function SponsorsManagerDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="Three sponsors: active with both formats, active with a strip only, and one that needs images (move one with the arrows; Delete asks first)"
        className="w-full"
      >
        <ManagerState initial={THREE} />
      </Specimen>
      <Specimen
        label="One inactive sponsor (both arrows off), one with a very long name, and one saved without a name"
        className="w-full"
      >
        <ManagerState
          initial={[
            { ad: { ...SAMPLE_AD_A, id: "off", active: false }, name: "Sample Estates" },
            { ad: { ...SAMPLE_AD_B, id: "long" }, name: LONG_NAME },
            { ad: { ...SAMPLE_AD_C, id: "unnamed" }, name: "" },
          ]}
        />
      </Specimen>
      <Specimen label="A single sponsor: both arrows are off" className="w-full">
        <ManagerState initial={[DEVELOPER]} />
      </Specimen>
      <Specimen label="Nothing yet: the message and its own Add sponsor button" className="w-full">
        <ManagerState initial={[]} />
      </Specimen>
      <Specimen
        label="Saving: Add sponsor and every button of every row are off"
        className="w-full"
      >
        <ManagerState initial={THREE} saving />
      </Specimen>
    </div>
  );
}

const PREVIEW_WORDS: SponsorHeroPreviewProps["words"] = {
  device: "Preview size",
  desktop: "Desktop",
  phone: "Phone",
  sponsored: "Sponsored",
  layouts: { search_desk: "Search Desk", split: "Split" },
  reasons: { no_sponsors: "No sponsors", none_eligible: "Split → Search Desk" },
  none: {
    title: "No banner is shown",
    text: "Visitors see the search card and then the next section. No frame, label or gap.",
  },
  phoneNote: "The phone image is used below 1024 px. Nothing is stretched.",
};

/** What the preview shows for the sponsors and the layout, worked out with the public site's own rules. */
function previewProps(
  samples: Sample[],
  values: SiteHeroValues,
): Pick<SponsorHeroPreviewProps, "banner" | "reason" | "caption"> {
  const ads = samples.map(({ ad }) => ad);
  const { format, shown } = heroCoverage(ads, values.layout);
  const first = samples.find(({ ad }) => ad.id === shown[0]);
  const creatives = first?.ad[format];
  if (!first || !creatives) {
    return { banner: null, reason: samples.length === 0 ? "no_sponsors" : "none_eligible" };
  }
  return {
    banner: { desktop: creatives.desktop.src, phone: creatives.compact.src, alt: first.ad.alt },
    caption: `${first.name} · first of ${shown.length} active`,
  };
}

const LAYOUT_NAME: Record<SponsorHeroLayout, string> = {
  search_desk: "Search Desk",
  split: "Split",
};

function PreviewCell({
  layout,
  samples,
  defaultDevice = "desktop",
}: {
  layout: SponsorHeroLayout;
  samples: Sample[];
  defaultDevice?: "desktop" | "phone";
}) {
  const values: SiteHeroValues = { eyebrow: "", title: STANDARD_HEADLINE, subtitle: "", layout };
  return (
    <div className="w-80 max-w-full rounded-xl border border-line bg-canvas-sunken p-4">
      <SponsorHeroPreview
        layout={layout}
        title={STANDARD_HEADLINE}
        words={PREVIEW_WORDS}
        defaultDevice={defaultDevice}
        {...previewProps(samples, values)}
      />
    </div>
  );
}

export function SponsorHeroPreviewDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Search Desk with the first sponsor that has a strip, on a desktop and on a phone (the switch changes the drawing)">
        <div className="flex flex-wrap items-start gap-6">
          <PreviewCell layout="search_desk" samples={THREE} />
          <PreviewCell layout="search_desk" samples={THREE} defaultDevice="phone" />
        </div>
      </Specimen>
      <Specimen label="Split with the first sponsor that has a panel: the banner beside the search on a desktop, under it on a phone">
        <div className="flex flex-wrap items-start gap-6">
          <PreviewCell layout="split" samples={THREE} />
          <PreviewCell layout="split" samples={THREE} defaultDevice="phone" />
        </div>
      </Specimen>
      <Specimen label="Split, but no active sponsor has a panel: visitors see Search Desk without a banner">
        <PreviewCell layout="split" samples={[BUILDER, FINANCE]} />
      </Specimen>
      <Specimen label="No sponsors at all: no banner, no frame, no gap">
        <PreviewCell layout="search_desk" samples={[]} />
      </Specimen>
    </div>
  );
}

/** The note under the layout cards: which layout is live, and a warning when sponsors cannot show in it. */
function layoutNote(samples: Sample[], layout: SponsorHeroLayout): ReactNode {
  const { format, active, shown, missing } = heroCoverage(
    samples.map(({ ad }) => ad),
    layout,
  );
  const name = LAYOUT_NAME[layout];
  const image = format === "panel" ? "Panel" : "Strip";
  let warning: ReactNode = null;
  if (active > 0 && shown.length === 0) {
    warning = (
      <Alert tone="warning" title={`No sponsor can be shown in ${name}`}>
        {layout === "split"
          ? `Visitors will see the Search Desk homepage without a banner until a sponsor supplies the ${image} format.`
          : `Visitors will see the homepage without a banner until a sponsor supplies the ${image} format.`}
      </Alert>
    );
  } else if (missing > 0) {
    warning = (
      <Alert
        tone="warning"
        title={`${missing} of ${active} sponsors ${missing === 1 ? "doesn't" : "don't"} have the ${name} format`}
      >
        {`${missing === 1 ? "It won't" : "They won't"} be shown while ${name} is live. Add a ${image} image to each in Sponsors below.`}
      </Alert>
    );
  }
  return (
    <>
      <p className="text-caption text-muted">
        Live layout: <b>{name}</b>. Changes apply on the next page load after you save.
      </p>
      {warning}
    </>
  );
}

function HeroSponsorsPage({
  initial,
  layout: initialLayout,
}: {
  initial: Sample[];
  layout: SponsorHeroLayout;
}) {
  const [values, setValues] = useState<SiteHeroValues>({
    eyebrow: "Tamil Nadu · Homes, plots & new projects",
    title: STANDARD_HEADLINE,
    subtitle: "Shortlist, compare and enquire directly.",
    layout: initialLayout,
  });
  const [samples, setSamples] = useState(initial);
  const subtitle = values.subtitle.trim();
  const eyebrow = values.eyebrow.trim();
  const move = (id: string, direction: "up" | "down") =>
    setSamples((current) => moved(current, id, direction));
  return (
    <SiteContentLayout
      title="Hero"
      description="The first thing visitors see on the home page, and the sponsored banner that can sit with it."
      tabs={tabs("hero")}
      tabsLabel="Site content"
      previewLabel="Live preview"
      preview={
        <SponsorHeroPreview
          layout={values.layout}
          title={values.title.trim() || STANDARD_HEADLINE}
          words={PREVIEW_WORDS}
          {...(subtitle ? { subtitle } : {})}
          {...(eyebrow ? { eyebrow } : {})}
          {...previewProps(samples, values)}
        />
      }
      after={
        <SponsorsManager
          {...MANAGER_TEXT}
          headingLevel="h3"
          rows={rowsOf(samples, { onDelete: NOTHING })}
          countText={countText(samples)}
          onAdd={NOTHING}
          onMove={move}
        />
      }
      footer={<SaveBar />}
      headingLevel="h2"
    >
      <SiteHeroFields
        values={values}
        onChange={setValues}
        words={HERO_WORDS}
        layoutNote={layoutNote(samples, values.layout)}
      />
    </SiteContentLayout>
  );
}

export function HeroSponsorsPageDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Search Desk with three sponsors (choose Split: two of the three have no panel, so the warning shows and the preview follows)">
        <HeroSponsorsPage initial={THREE} layout="search_desk" />
      </Specimen>
      <Specimen label="Split chosen but no active sponsor has a panel: the warning says visitors will see Search Desk without a banner">
        <HeroSponsorsPage initial={[BUILDER, FINANCE]} layout="split" />
      </Specimen>
      <Specimen label="No sponsors yet: the list says so and the preview shows no banner">
        <HeroSponsorsPage initial={[]} layout="search_desk" />
      </Specimen>
    </div>
  );
}
