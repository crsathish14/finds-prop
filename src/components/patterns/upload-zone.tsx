"use client";

/**
 * UploadZone: a drop area and file picker with a list of the chosen files. User interface only.
 * Purpose: the photo and document steps of the post-property flow. Owner: design system. It does
 *   not upload anything: the feature passes onFiles, then reports progress and errors back through
 *   `files`. Validation of type and size is the feature's job (and the server's).
 *   A file can show a small picture of itself (`previewUrl`) and a line of progress text (`status`).
 * Props: files ({ id, name, progress? 0 to 100, error?, cover?, previewUrl?, status? }), onFiles, onRemove, accept,
 *   multiple, disabled, labels ({ title, hint, browse, remove(name) -> text, cover }, all already-
 *   translated), className.
 * Responsive: full width; the list stacks under the zone.
 * Accessibility: the whole zone is one labelled file input, so it works with the keyboard and
 *   with a screen reader, not only by dragging. Progress is a real progress element named by the
 *   file; an error is text next to the file. Each remove button names its file.
 * States: default, drag over, disabled; per file: uploading, done, error, cover.
 * Dependencies: Icon, IconButton, Badge. Tests: forms.test.tsx; Design Lab "Fields" (S2-T07).
 * UX reference: ds-components, upload zone (c-data.css .drop).
 */
import { CircleAlert, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useId, useState, type DragEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";

type UploadFile = {
  id: string;
  name: string;
  progress?: number;
  error?: string;
  cover?: boolean;
  /** A small picture of the file (an address the browser can show). Decorative: the name says what it is. */
  previewUrl?: string;
  /** A line of progress text under the name while the file is on its way, such as "Uploading". */
  status?: string;
};

type UploadLabels = {
  title: string;
  hint: string;
  cover: string;
  remove: (name: string) => string;
};

type UploadZoneProps = {
  files: UploadFile[];
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  labels: UploadLabels;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
};

function UploadZone({
  files,
  onFiles,
  onRemove,
  labels,
  accept,
  multiple = true,
  disabled = false,
  className,
}: UploadZoneProps) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = Array.from(event.dataTransfer.files);
    if (dropped.length > 0) onFiles(multiple ? dropped : dropped.slice(0, 1));
  }

  return (
    <div data-slot="upload-zone" className={cn("flex flex-col gap-4", className)}>
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line-input bg-surface px-5 py-8 text-center transition-colors duration-(--dur-fast)",
          "hover:border-primary hover:bg-primary-tint has-[input:focus-visible]:outline-(length:--focus-w) has-[input:focus-visible]:outline-offset-2",
          dragging && "border-primary bg-primary-tint",
          disabled &&
            "cursor-not-allowed border-line-strong bg-canvas-sunken hover:border-line-strong hover:bg-canvas-sunken",
        )}
      >
        <span className="grid size-13 place-items-center rounded-pill bg-primary-tint text-primary">
          <Icon icon={Upload} size="lg" />
        </span>
        <span className="text-body font-bold text-ink">{labels.title}</span>
        <span className="text-small text-muted">{labels.hint}</span>
        <input
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            const chosen = Array.from(event.target.files ?? []);
            if (chosen.length > 0) onFiles(chosen);
            event.target.value = "";
          }}
        />
      </label>
      {files.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {files.map((file) => (
            <li
              key={file.id}
              className={cn(
                "flex items-center gap-3 rounded-md border border-line bg-surface px-4 py-3",
                file.error && "border-danger",
              )}
            >
              {file.previewUrl ? (
                <Image
                  src={file.previewUrl}
                  alt=""
                  width={48}
                  height={48}
                  unoptimized
                  className="size-12 shrink-0 rounded-md object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-semibold text-ink">{file.name}</p>
                {file.error ? (
                  <p className="flex items-start gap-2 text-caption font-semibold text-danger">
                    <Icon icon={CircleAlert} size="sm" className="mt-px" />
                    {file.error}
                  </p>
                ) : file.progress !== undefined && file.progress < 100 ? (
                  <>
                    {file.status ? <p className="text-caption text-muted">{file.status}</p> : null}
                    <progress
                      aria-label={file.name}
                      value={file.progress}
                      max={100}
                      className="mt-1 h-1.5 w-full appearance-none overflow-hidden rounded-pill bg-line-strong [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-line-strong [&::-webkit-progress-value]:bg-primary"
                    />
                  </>
                ) : null}
              </div>
              {file.cover ? <Badge tone="featured">{labels.cover}</Badge> : null}
              <IconButton aria-label={labels.remove(file.name)} onClick={() => onRemove(file.id)}>
                <Icon icon={Trash2} />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export { UploadZone };
export type { UploadFile, UploadLabels };
