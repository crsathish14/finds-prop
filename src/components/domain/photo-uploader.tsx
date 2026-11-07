"use client";

/**
 * PhotoUploader: the photo step of posting a property, as a screen (S6-T01, FR-ACC-07).
 * Purpose: the drop area, the list of photos with a small picture, a progress bar and a step name on each,
 *   a cover tag on the first saved photo, a remove button on each, and "3 of 6 photos". Owner: design
 *   system. It is the screen only: the feature (`features/media/photo-uploader.client.tsx`) prepares,
 *   uploads and saves the photos, and tells this what each one is doing.
 * Props: photos ({ id, name, previewUrl?, stage: preparing, uploading, saving, removing, done or error,
 *   error? (already translated) }), max (the most photos), onFiles, onRemove, notice (a warning shown above
 *   the list, such as "session ended"), disabled, className.
 * Responsive: full width of its step; the list stacks under the drop area.
 * Accessibility: built on UploadZone, so the whole drop area is one labelled file input that works by
 *   keyboard and screen reader; the count is a polite status; each row's bar is a real progress element
 *   named by the file; an error is text next to the file; each remove button names its file.
 * States: empty, some photos, some on their way (one per step), cover, error rows, full (the drop area is
 *   turned off at the maximum), a notice above.
 * Dependencies: UploadZone, next-intl. Tests: photo-uploader.test.tsx; Design Lab "Domain" (S6-T01).
 * UX reference: post-property.html step 3 (the photos step); the list-with-picture look is this task's
 *   choice, the UX draws a grid of pictures, to be revisited with the wizard (S6-T02).
 */
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { UploadZone, type UploadFile } from "@/components/patterns/upload-zone";
import { cn } from "@/lib/cn";

type PhotoUploaderStage = "preparing" | "uploading" | "saving" | "removing" | "done" | "error";

type PhotoUploaderPhoto = {
  id: string;
  name: string;
  previewUrl?: string;
  stage: PhotoUploaderStage;
  error?: string;
};

type PhotoUploaderProps = {
  photos: PhotoUploaderPhoto[];
  max: number;
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  notice?: ReactNode;
  disabled?: boolean;
  className?: string;
};

/** Steps, not bytes: a fetch gives no byte progress, so the bar moves by step. */
const STEP_PROGRESS = { preparing: 20, uploading: 55, saving: 85, removing: 90 } as const;

/** JPEG, PNG and WebP. HEIC is left out on purpose: a phone's picker then hands over a JPEG instead. */
const ACCEPT = "image/jpeg,image/png,image/webp";

function PhotoUploader({
  photos,
  max,
  onFiles,
  onRemove,
  notice,
  disabled = false,
  className,
}: PhotoUploaderProps) {
  const translate = useTranslations("domain.photoUploader");
  const inUse = photos.filter((photo) => photo.stage !== "error").length;
  const cover = photos.find((photo) => photo.stage === "done" || photo.stage === "removing")?.id;

  // Written out one by one: message keys are never built from variables (the messages check).
  const stepText = {
    preparing: translate("stage.preparing"),
    uploading: translate("stage.uploading"),
    saving: translate("stage.saving"),
    removing: translate("stage.removing"),
  } as const;

  const files: UploadFile[] = photos.map((photo) => {
    const step = photo.stage === "done" || photo.stage === "error" ? undefined : photo.stage;
    return {
      id: photo.id,
      name: photo.name,
      ...(photo.previewUrl ? { previewUrl: photo.previewUrl } : {}),
      ...(photo.error ? { error: photo.error } : {}),
      ...(step ? { progress: STEP_PROGRESS[step], status: stepText[step] } : {}),
      ...(photo.id === cover ? { cover: true } : {}),
    };
  });

  return (
    <div data-slot="photo-uploader" className={cn("flex flex-col gap-4", className)}>
      {notice}
      <UploadZone
        files={files}
        onFiles={onFiles}
        onRemove={onRemove}
        accept={ACCEPT}
        multiple
        disabled={disabled || inUse >= max}
        labels={{
          title: translate("title"),
          hint: translate("hint"),
          cover: translate("cover"),
          remove: (name) => translate("remove", { name }),
        }}
      />
      <p role="status" className="text-small text-muted">
        {translate("counter", { count: inUse, max })}
      </p>
    </div>
  );
}

export { PhotoUploader };
export type { PhotoUploaderPhoto, PhotoUploaderProps, PhotoUploaderStage };
