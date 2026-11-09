"use client";

import { useState } from "react";
import { PriceTrendsEditor, type PriceTrendRow } from "@/components/domain/price-trends-editor";
import {
  ProjectMedia,
  type ProjectMediaGroupName,
  type ProjectMediaProps,
  type ProjectMediaWords,
} from "@/components/domain/project-media";
import { FormSection } from "@/components/patterns/form-section";
import {
  MediaGroupField,
  type MediaGroupWords,
  type MediaItem,
} from "@/components/patterns/media-group-field";
import { Specimen } from "../frame";

/**
 * The project form's media section and the admin's price trends in their states (S7-T02, part B2). Plain English
 * text; nothing here is uploaded or saved: choosing a file only adds a tile that says it is done. The words that
 * are not in the approved UX file are listed in ADR-088 for the owner to confirm.
 */

const PICTURES = "/design-lab/listings";

const FILE_WORDS: MediaGroupWords = {
  add: "Add files",
  remove: (name) => `Remove: ${name}`,
  uploading: "Uploading",
  removing: "Removing",
  full: "The group is full.",
};

const MEDIA_WORDS: ProjectMediaWords = {
  locked: "Save the project first, then add its images, floor plans and brochure.",
  groups: {
    images: { label: "Project images", hint: "The first image is the cover." },
    floorPlans: { label: "Floor plans" },
    elevations: { label: "Elevations" },
    plotImages: { label: "Plot images" },
    brochure: { label: "Brochure (PDF)" },
  },
  files: FILE_WORDS,
  videos: {
    label: "Videos",
    hint: "Links that start with https://.",
    tags: {
      placeholder: "Paste a video link",
      add: "Add",
      remove: "Remove",
      suggestions: "Suggestions",
      full: "The list is full.",
    },
  },
};

const picture = (
  id: string,
  name: string,
  file: string,
  stage: MediaItem["stage"] = "done",
): MediaItem => ({
  id,
  name,
  kind: "image",
  previewUrl: `${PICTURES}/${file}`,
  stage,
});

const FILLED: Record<ProjectMediaGroupName, MediaItem[]> = {
  images: [
    picture("i1", "front-view.jpg", "home-a.svg"),
    picture("i2", "clubhouse.jpg", "home-b.svg"),
    picture("i3", "courtyard.jpg", "home-c.svg"),
    picture("i4", "podium-garden.jpg", "home-a.svg"),
  ],
  floorPlans: [
    picture("f1", "two-bhk-plan.png", "home-b.svg"),
    picture("f2", "three-bhk-plan.png", "home-c.svg"),
  ],
  elevations: [picture("e1", "tower-a-elevation.png", "home-a.svg")],
  plotImages: [],
  brochure: [{ id: "b1", name: "kadal-vista-brochure.pdf", kind: "file", stage: "done" }],
};

const EMPTY: Record<ProjectMediaGroupName, MediaItem[]> = {
  images: [],
  floorPlans: [],
  elevations: [],
  plotImages: [],
  brochure: [],
};

const BUSY: Record<ProjectMediaGroupName, MediaItem[]> = {
  ...FILLED,
  images: [
    ...FILLED.images,
    picture("i5", "terrace.jpg", "home-b.svg", "uploading"),
    picture("i6", "gym.jpg", "home-c.svg", "removing"),
    {
      id: "i7",
      name: "aerial-view-of-the-whole-township-at-sunrise-from-the-east-gate.jpg",
      kind: "image",
      stage: "error",
      error: "Too large (14 MB). The most is 10 MB.",
    },
  ],
  brochure: [
    {
      id: "b2",
      name: "brochure.docx",
      kind: "file",
      stage: "error",
      error: "Use a PDF file.",
    },
  ],
};

let counter = 0;
const nextId = () => `new-${(counter += 1)}`;

/** The media section as a page would hold it: a chosen file shows up as done at once. */
function LiveMedia({
  initial,
  videos = [],
  locked = false,
  disabled = false,
}: {
  initial: Record<ProjectMediaGroupName, MediaItem[]>;
  videos?: string[];
  locked?: boolean;
  disabled?: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [links, setLinks] = useState(videos);
  const groups: ProjectMediaProps["groups"] = {
    images: { items: items.images },
    floorPlans: { items: items.floorPlans },
    elevations: { items: items.elevations },
    plotImages: { items: items.plotImages },
    brochure: { items: items.brochure },
  };
  return (
    <div className="w-full max-w-205">
      <FormSection
        id="media"
        title="Media"
        description="Images, floor plans, elevations and the brochure. JPG, PNG, WEBP or PDF, up to 10 MB each."
      >
        <ProjectMedia
          groups={groups}
          videos={links}
          locked={locked}
          disabled={disabled}
          words={MEDIA_WORDS}
          onFiles={(group, files) =>
            setItems((now) => ({
              ...now,
              [group]: [
                ...now[group],
                ...files.map((file): MediaItem => ({
                  id: nextId(),
                  name: file.name,
                  kind: file.type.startsWith("image/") ? "image" : "file",
                  stage: "done",
                })),
              ],
            }))
          }
          onRemove={(group, id) =>
            setItems((now) => ({ ...now, [group]: now[group].filter((item) => item.id !== id) }))
          }
          onVideosChange={setLinks}
        />
      </FormSection>
    </div>
  );
}

export function ProjectMediaDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="A new project, not saved yet: a note says why, and every box is off">
        <LiveMedia initial={EMPTY} locked />
      </Specimen>
      <Specimen label="A saved project with files in each group, the brochure and two video links (add a file, remove one, add a link)">
        <LiveMedia
          initial={FILLED}
          videos={[
            "https://www.example.com/watch/kadal-vista-walkthrough",
            "https://www.example.com/watch/clubhouse-tour",
          ]}
        />
      </Specimen>
      <Specimen label="Files on their way: one uploading, one being removed, one too large (with a very long name) and a brochure that is not a PDF">
        <LiveMedia initial={BUSY} />
      </Specimen>
      <Specimen label="Saving: every box is off">
        <LiveMedia
          initial={FILLED}
          videos={["https://www.example.com/watch/kadal-vista-walkthrough"]}
          disabled
        />
      </Specimen>
    </div>
  );
}

function GroupDemoState({
  initial,
  max,
  accept,
  label,
  hint,
  error,
  disabled,
}: {
  initial: MediaItem[];
  max: number;
  accept: string;
  label: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
}) {
  const [items, setItems] = useState(initial);
  return (
    <div className="w-full max-w-205 rounded-xl border border-line bg-surface p-6">
      <MediaGroupField
        label={label}
        items={items}
        max={max}
        accept={accept}
        {...(hint ? { hint } : {})}
        {...(error ? { error } : {})}
        {...(disabled ? { disabled } : {})}
        words={FILE_WORDS}
        onFiles={(files) =>
          setItems((now) => [
            ...now,
            ...files.map((file): MediaItem => ({
              id: nextId(),
              name: file.name,
              kind: file.type.startsWith("image/") ? "image" : "file",
              stage: "done",
            })),
          ])
        }
        onRemove={(id) => setItems((now) => now.filter((item) => item.id !== id))}
      />
    </div>
  );
}

const IMAGE_TYPES = "image/jpeg,image/png,image/webp";

export function MediaGroupFieldDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Empty: one tile to add files (choose or drop; the count starts at 0)">
        <GroupDemoState
          label="Project images"
          initial={[]}
          max={20}
          accept={IMAGE_TYPES}
          hint="The first image is the cover."
        />
      </Specimen>
      <Specimen label="Some pictures, with a file that is not a picture (a PDF plan) among them">
        <GroupDemoState
          label="Floor plans"
          max={20}
          accept={IMAGE_TYPES}
          initial={[
            picture("a", "two-bhk-plan.png", "home-a.svg"),
            picture("b", "three-bhk-plan.png", "home-b.svg"),
            { id: "c", name: "tower-b-plan.pdf", kind: "file", stage: "done" },
          ]}
        />
      </Specimen>
      <Specimen label="One file only (a brochure): full, so the add tile is gone and the group says so; the x still removes it">
        <GroupDemoState
          label="Brochure (PDF)"
          max={1}
          accept="application/pdf"
          initial={[{ id: "p", name: "kadal-vista-brochure.pdf", kind: "file", stage: "done" }]}
        />
      </Specimen>
      <Specimen label="With an error on the group">
        <GroupDemoState
          label="Elevations"
          max={20}
          accept={IMAGE_TYPES}
          initial={[]}
          error="Add no more than 20 elevations."
        />
      </Specimen>
      <Specimen label="Off while saving">
        <GroupDemoState
          label="Plot images"
          max={20}
          accept={IMAGE_TYPES}
          initial={[picture("z", "layout.png", "home-c.svg")]}
          disabled
        />
      </Specimen>
    </div>
  );
}

const TREND_WORDS = {
  title: "Price trends",
  description: "Monthly price per sq.ft shown as a chart on the project page.",
  month: "Month",
  price: "₹ per sq.ft",
  monthFormat: "yyyy-mm",
  add: "Add month",
  remove: (month: string) => `Remove ${month}`,
  empty: "No months yet. Add a month to start the chart.",
  full: "The list is full.",
};

const SAMPLE_ROWS: PriceTrendRow[] = [
  { id: "t1", month: "2026-10", price: "8350" },
  { id: "t2", month: "2026-09", price: "8230" },
  { id: "t3", month: "2026-08", price: "8110" },
  { id: "t4", month: "2026-07", price: "7980" },
];

/** The box as a page would hold it: a new row starts empty. */
function TrendsDemoState({
  initial,
  max = 120,
  errors,
  disabled,
}: {
  initial: PriceTrendRow[];
  max?: number;
  errors?: Record<string, { month?: string; price?: string }>;
  disabled?: boolean;
}) {
  const [rows, setRows] = useState(initial);
  return (
    <div className="w-full max-w-80">
      <PriceTrendsEditor
        rows={rows}
        max={max}
        {...(errors ? { errors } : {})}
        {...(disabled ? { disabled } : {})}
        words={TREND_WORDS}
        onAdd={() => setRows((now) => [...now, { id: nextId(), month: "", price: "" }])}
        onRemove={(id) => setRows((now) => now.filter((row) => row.id !== id))}
        onChange={(id, field, value) =>
          setRows((now) => now.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
        }
      />
    </div>
  );
}

export function PriceTrendsEditorDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Empty (the side column of the admin's form is 320 px wide; try Add month)">
        <TrendsDemoState initial={[]} />
      </Specimen>
      <Specimen label="Four months (change a month or a price, remove one)">
        <TrendsDemoState initial={SAMPLE_ROWS} />
      </Specimen>
      <Specimen label="With problems: a month listed twice, a month missing, a price too high and a price that is not a number">
        <TrendsDemoState
          initial={[
            { id: "e1", month: "2026-10", price: "8350" },
            { id: "e2", month: "2026-10", price: "99999999" },
            { id: "e3", month: "", price: "8110" },
            { id: "e4", month: "2026-07", price: "eight" },
          ]}
          errors={{
            e2: { month: "This month is listed twice.", price: "The most is 1,00,00,000." },
            e3: { month: "Choose the month." },
            e4: { price: "Enter a whole number." },
          }}
        />
      </Specimen>
      <Specimen label="Full (4 of 4): Add month is off and the card says so">
        <TrendsDemoState initial={SAMPLE_ROWS} max={4} />
      </Specimen>
      <Specimen label="Saving: every box is off">
        <TrendsDemoState initial={SAMPLE_ROWS.slice(0, 2)} disabled />
      </Specimen>
    </div>
  );
}
