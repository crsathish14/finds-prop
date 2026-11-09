"use client";

/**
 * MediaGroupField: one group of files on a form (project images, floor plans, brochure) as a grid of tiles.
 * Purpose: the Media section of the project form (S7-T02, FR-ADM-04, FR-BLD-02) and any other form that keeps a
 *   few named groups of pictures or documents. Owner: design system. It uploads nothing: the page passes onFiles,
 *   then reports each file's step and error back through `items`. Checking the type and size is the page's job
 *   (and the bucket's).
 * Props: label, items ({ id, name, kind: image | file, previewUrl?, stage: uploading, removing, done or error,
 *   error? (already translated) }), max (the most files; 1 makes it a single-file field), accept (the file types the
 *   picker offers), onFiles, onRemove (id), hint, error (for the group), disabled, words ({ add, remove(name),
 *   uploading, removing, full }, already translated), className.
 * Responsive: two tiles to a line on a phone, three from 768 px, four from 1100 px of screen; names are cut with
 *   an ellipsis.
 * Accessibility: the group is named by its label; the last tile is one labelled file input, so it works by
 *   keyboard and screen reader, not only by dragging; a tile's progress is a real progress element named by
 *   the file; an error is text on the tile; each remove button names its file; the count (3 / 20) is text.
 * States: empty, some files, one on its way, one being removed, one with an error, full (the add tile is gone and
 *   the group says so), disabled, group error.
 * Dependencies: Icon, IconButton, cn. Tests: media-and-trends.test.tsx; Design Lab "Admin" (S7-T02).
 * UX reference: admin-project-form screen (.drop and .photos in the Media section).
 */
import { CircleAlert, FileText, Upload, X } from "lucide-react";
import Image from "next/image";
import { useId, useState, type DragEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";

type MediaItemStage = "uploading" | "removing" | "done" | "error";

type MediaItem = {
  id: string;
  name: string;
  kind: "image" | "file";
  /** A small picture of an image (an address the browser can show). Decorative: the name says what it is. */
  previewUrl?: string;
  stage: MediaItemStage;
  error?: string;
};

type MediaGroupWords = {
  /** The add tile: "Add files". */
  add: string;
  /** What the x says for a file: "Remove: plan.png". */
  remove: (name: string) => string;
  /** Said on a tile while its file is on its way. */
  uploading: string;
  /** Said on a tile while its file is being removed. */
  removing: string;
  /** Said when the group holds as many as it may. */
  full: string;
};

type MediaGroupFieldProps = {
  label: string;
  items: readonly MediaItem[];
  max: number;
  accept: string;
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
  words: MediaGroupWords;
  className?: string;
};

/** Steps, not bytes: a request gives no byte progress, so the bar shows that the file is on its way. */
const UPLOADING_PROGRESS = 55;

function Tile({
  item,
  words,
  disabled,
  onRemove,
}: {
  item: MediaItem;
  words: MediaGroupWords;
  disabled: boolean;
  onRemove: (id: string) => void;
}) {
  const busy = item.stage === "uploading" || item.stage === "removing";
  return (
    <li className="flex min-w-0 flex-col gap-2">
      <div
        className={cn(
          "relative aspect-4/3 overflow-hidden rounded-md border border-line bg-canvas-sunken",
          item.stage === "error" && "border-danger",
          item.stage === "removing" && "opacity-60",
        )}
      >
        {item.kind === "image" && item.previewUrl ? (
          <Image
            src={item.previewUrl}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 768px) 200px, 50vw"
            className="object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center text-muted">
            <Icon icon={FileText} size="lg" />
          </span>
        )}
        <IconButton
          aria-label={words.remove(item.name)}
          disabled={disabled || busy}
          onClick={() => onRemove(item.id)}
          className="absolute top-1 right-1 border border-line bg-surface"
        >
          <Icon icon={X} />
        </IconButton>
        {busy ? (
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-surface/90 px-2 py-2">
            <span className="text-caption text-muted">
              {item.stage === "uploading" ? words.uploading : words.removing}
            </span>
            <progress
              aria-label={item.name}
              value={item.stage === "uploading" ? UPLOADING_PROGRESS : 90}
              max={100}
              className="h-1.5 w-full appearance-none overflow-hidden rounded-pill bg-line-strong [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-line-strong [&::-webkit-progress-value]:bg-primary"
            />
          </div>
        ) : null}
      </div>
      <p className="truncate text-caption font-semibold text-ink">{item.name}</p>
      {item.error ? (
        <p className="flex items-start gap-2 text-caption font-semibold text-danger">
          <Icon icon={CircleAlert} size="sm" className="mt-px" />
          {item.error}
        </p>
      ) : null}
    </li>
  );
}

function MediaGroupField({
  label,
  items,
  max,
  accept,
  onFiles,
  onRemove,
  hint,
  error,
  disabled = false,
  words,
  className,
}: MediaGroupFieldProps) {
  const inputId = useId();
  const labelId = `${inputId}-label`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const [dragging, setDragging] = useState(false);
  const used = items.filter((item) => item.stage !== "error").length;
  const full = used >= max;
  const off = disabled || full;

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (off) return;
    const dropped = Array.from(event.dataTransfer.files);
    if (dropped.length > 0) onFiles(max === 1 ? dropped.slice(0, 1) : dropped);
  }

  const describedBy = [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ");

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      {...(describedBy ? { "aria-describedby": describedBy } : {})}
      data-slot="media-group-field"
      className={cn("flex min-w-0 flex-col gap-3", className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p id={labelId} className="text-small font-semibold text-ink">
          {label}
        </p>
        <p className="text-caption text-muted">
          {used} / {max}
        </p>
      </div>
      {hint ? (
        <p id={hintId} className="text-caption text-muted">
          {hint}
        </p>
      ) : null}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 portal:grid-cols-4">
        {items.map((item) => (
          <Tile key={item.id} item={item} words={words} disabled={disabled} onRemove={onRemove} />
        ))}
        {full ? null : (
          <li className="min-w-0">
            <label
              htmlFor={inputId}
              onDragOver={(event) => {
                event.preventDefault();
                if (!off) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "flex aspect-4/3 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-line-input bg-surface px-2 text-center transition-colors duration-(--dur-fast)",
                "hover:border-primary hover:bg-primary-tint has-[input:focus-visible]:outline-(length:--focus-w) has-[input:focus-visible]:outline-offset-2",
                dragging && "border-primary bg-primary-tint",
                error && "border-danger",
                disabled &&
                  "cursor-not-allowed border-line-strong bg-canvas-sunken hover:border-line-strong hover:bg-canvas-sunken",
              )}
            >
              <Icon icon={Upload} size="lg" className="text-primary" />
              <span className="text-small font-semibold text-ink">{words.add}</span>
              <input
                id={inputId}
                type="file"
                accept={accept}
                multiple={max > 1}
                disabled={off}
                className="sr-only"
                onChange={(event) => {
                  const chosen = Array.from(event.target.files ?? []);
                  if (chosen.length > 0) onFiles(chosen);
                  event.target.value = "";
                }}
              />
            </label>
          </li>
        )}
      </ul>
      {full ? <p className="text-caption text-muted">{words.full}</p> : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-2 text-caption font-semibold text-danger">
          <Icon icon={CircleAlert} size="sm" className="mt-px" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { MediaGroupField };
export type { MediaGroupFieldProps, MediaGroupWords, MediaItem, MediaItemStage };
