"use client";

/**
 * ProjectMedia: the inside of the project form's Media section: image groups, the brochure and video links.
 * Purpose: what the admin and a builder add to a project besides text (S7-T02, FR-ADM-04, FR-BLD-02). Owner: design
 *   system. It goes in the `media` slot of ProjectFields. It holds no state and uploads nothing: the page sends each
 *   chosen file to the project's folder in the media bucket, reports its steps back through the groups, and keeps
 *   the paths and the links.
 * Props: groups (images, floorPlans, elevations, plotImages and brochure, each { items: MediaItem[], error? }),
 *   videos (the https links), videosError, onFiles (group, files), onRemove (group, id), onVideosChange (links),
 *   locked (the project is not saved yet, so it has no folder: every box is off and a note says why), disabled
 *   (while saving), words (the notes, each group's label and hint, the file words, the video words), className.
 * Limits shown: up to 20 files in each image group, one brochure, up to 5 video links; the picker offers JPG,
 *   PNG and WEBP for the image groups and PDF for the brochure. The page still checks the type and the size
 *   (10 MB), and the bucket does too.
 * Responsive: one column of groups on every screen; each group's tiles reflow (see MediaGroupField).
 * Accessibility: every group is a named group with its own count and file input; the locked note is read
 *   politely; see MediaGroupField and TagListField.
 * States: locked (a new project), empty, some files, files on their way, files with errors, full groups, saving.
 * Dependencies: MediaGroupField, TagListField, Alert, cn. Tests: media-and-trends.test.tsx; Design Lab "Admin"
 *   (S7-T02).
 * UX reference: admin-project-form screen, Media section (.drop, .photos, brochure row, video chips).
 */
import { Alert } from "@/components/patterns/alert";
import {
  MediaGroupField,
  type MediaGroupWords,
  type MediaItem,
} from "@/components/patterns/media-group-field";
import { TagListField, type TagListWords } from "@/components/patterns/tag-list-field";
import { cn } from "@/lib/cn";

type ProjectMediaGroupName = "images" | "floorPlans" | "elevations" | "plotImages" | "brochure";

type ProjectMediaGroup = { items: readonly MediaItem[]; error?: string };

type ProjectMediaWords = {
  /** Shown while the project is not saved yet: "Save the project first to add media." */
  locked: string;
  groups: Record<ProjectMediaGroupName, { label: string; hint?: string }>;
  files: MediaGroupWords;
  videos: { label: string; hint?: string; tags: TagListWords };
};

type ProjectMediaProps = {
  groups: Record<ProjectMediaGroupName, ProjectMediaGroup>;
  videos: readonly string[];
  videosError?: string;
  onFiles: (group: ProjectMediaGroupName, files: File[]) => void;
  onRemove: (group: ProjectMediaGroupName, id: string) => void;
  onVideosChange: (videos: string[]) => void;
  locked?: boolean;
  disabled?: boolean;
  words: ProjectMediaWords;
  className?: string;
};

const IMAGE_TYPES = "image/jpeg,image/png,image/webp";

/** Each group's picker types and its limit; the same limits as the server (ADR-086). */
const GROUPS: { name: ProjectMediaGroupName; accept: string; max: number }[] = [
  { name: "images", accept: IMAGE_TYPES, max: 20 },
  { name: "floorPlans", accept: IMAGE_TYPES, max: 20 },
  { name: "elevations", accept: IMAGE_TYPES, max: 20 },
  { name: "plotImages", accept: IMAGE_TYPES, max: 20 },
  { name: "brochure", accept: "application/pdf", max: 1 },
];

const VIDEOS_MAX = 5;
const LINK_MAX = 300;

function ProjectMedia({
  groups,
  videos,
  videosError,
  onFiles,
  onRemove,
  onVideosChange,
  locked = false,
  disabled = false,
  words,
  className,
}: ProjectMediaProps) {
  const off = disabled || locked;
  return (
    <div data-slot="project-media" className={cn("flex min-w-0 flex-col gap-6", className)}>
      {locked ? <Alert tone="info">{words.locked}</Alert> : null}
      {GROUPS.map(({ name, accept, max }) => {
        const group = groups[name];
        const text = words.groups[name];
        return (
          <MediaGroupField
            key={name}
            label={text.label}
            {...(text.hint ? { hint: text.hint } : {})}
            {...(group.error ? { error: group.error } : {})}
            items={group.items}
            max={max}
            accept={accept}
            onFiles={(files) => onFiles(name, files)}
            onRemove={(id) => onRemove(name, id)}
            disabled={off}
            words={words.files}
          />
        );
      })}
      <TagListField
        label={words.videos.label}
        tags={videos}
        onChange={onVideosChange}
        max={VIDEOS_MAX}
        maxLength={LINK_MAX}
        {...(words.videos.hint ? { hint: words.videos.hint } : {})}
        {...(videosError ? { error: videosError } : {})}
        disabled={off}
        words={words.videos.tags}
      />
    </div>
  );
}

export { ProjectMedia };
export type { ProjectMediaGroup, ProjectMediaGroupName, ProjectMediaProps, ProjectMediaWords };
