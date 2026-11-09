"use client";

/**
 * SponsorImageSlot: one of the four picture slots of a sponsor (strip or panel, desktop or phone) in the admin's sponsor form.
 * Purpose: shows the slot's name and the size it is shown at, a preview at the slot's true shape, what happened to the
 *   chosen file ("Fills the slot", "Rejected: wrong shape") and the actions that fit (S7-T11, FR-ADM-11, DEC-15). Owner:
 *   design system. It does not upload or check anything: the page passes `onFile` and then says what came of it through
 *   `state` and `status`; the same rules also run on the server, which reads the stored file itself.
 * Props: title ("Strip · desktop"), note ("Shown at 970 × 90 · supply 1940 × 180"), ratio ({ width, height } of the slot),
 *   state ("empty" | "filled" | "near" | "rejected" | "checking"), image ({ src, alt } for the preview), fileName (shown
 *   in the box when a refused file has no picture), status ({ title, text }: the line under the preview), words (all
 *   already translated: dropTitle, dropText, choose, replace, remove, chooseAnother, keep, checking, previewAlt),
 *   accept, onFile, onRemove, onKeep, disabled, className.
 * Responsive: fills its column; the preview keeps the slot's shape at every width, so nothing is stretched.
 * Accessibility: the empty preview is the file picker's label (keyboard and screen reader work, not only dragging);
 *   the status is text with an icon, never colour alone: "Fills the slot" is read politely, a refusal is an alert; each
 *   button names its slot; while checking, the slot is marked busy and nothing in it can be pressed.
 * States: empty, filled (fills the slot), near (shown whole on a plain background), rejected, checking, disabled.
 * Dependencies: Button, Icon, cn. Tests: sponsor-parts.test.tsx; Design Lab "Sponsors" (S7-T11).
 * UX reference: admin-sponsors screen (.slot, .slot-prev, .slot-st).
 */
import { CircleAlert, CircleCheck, CircleX, FileImage, Upload } from "lucide-react";
import Image from "next/image";
import { useId, useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type SponsorImageSlotState = "empty" | "filled" | "near" | "rejected" | "checking";

type SponsorImageSlotWords = {
  dropTitle: string;
  dropText: string;
  choose: string;
  replace: string;
  remove: string;
  chooseAnother: string;
  keep: string;
  checking: string;
  previewAlt: string;
};

type SponsorImageSlotProps = {
  title: string;
  note: string;
  ratio: { width: number; height: number };
  state: SponsorImageSlotState;
  image?: { src: string; alt?: string };
  fileName?: string;
  status?: { title: string; text: string };
  words: SponsorImageSlotWords;
  accept?: string;
  onFile: (file: File) => void;
  onRemove?: () => void;
  onKeep?: () => void;
  disabled?: boolean;
  className?: string;
};

const STATUS_LOOK = {
  filled: { icon: CircleCheck, box: "bg-success-tint", head: "text-success", role: "status" },
  near: { icon: CircleAlert, box: "bg-warning-tint", head: "text-warning", role: "status" },
  rejected: { icon: CircleX, box: "bg-danger-tint", head: "text-danger", role: "alert" },
} as const;

function SponsorImageSlot({
  title,
  note,
  ratio,
  state,
  image,
  fileName,
  status,
  words,
  accept = "image/jpeg,image/png,image/webp",
  onFile,
  onRemove,
  onKeep,
  disabled = false,
  className,
}: SponsorImageSlotProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const busy = state === "checking";
  const locked = disabled || busy;

  const choose = () => input.current?.click();
  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped && !locked) onFile(dropped);
  };

  const shape = { aspectRatio: `${ratio.width} / ${ratio.height}` };
  const look =
    state === "filled" || state === "near" || state === "rejected" ? STATUS_LOOK[state] : null;
  const showsPicture =
    image !== undefined && (state === "filled" || state === "near" || state === "rejected");
  const nameId = `${inputId}-name`;
  /** A button's name says which of the four slots it is for: "Replace: Strip · desktop". */
  const named = (word: string) => `${word}: ${title}`;

  return (
    <div
      data-slot="sponsor-image-slot"
      data-state={state}
      aria-busy={busy || undefined}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-lg border bg-surface p-4",
        state === "rejected" ? "border-danger" : "border-line",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <p id={nameId} className="font-bold text-ink">
          {title}
        </p>
        <p className="text-caption text-muted">{note}</p>
      </div>

      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          if (!locked) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={shape}
        className={cn(
          "relative block w-full overflow-hidden rounded-md border border-line bg-canvas",
          !locked && "cursor-pointer",
          locked && "cursor-not-allowed",
          dragging && "border-primary bg-primary-tint",
          "has-[input:focus-visible]:outline-(length:--focus-w) has-[input:focus-visible]:outline-offset-2",
        )}
      >
        {showsPicture ? (
          <Image
            src={image.src}
            alt={image.alt ?? words.previewAlt}
            fill
            unoptimized
            sizes="(min-width: 768px) 680px, 100vw"
            className={cn("object-cover", state === "near" && "bg-canvas-sunken object-contain")}
          />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 text-center">
            <Icon
              icon={state === "rejected" && fileName ? FileImage : Upload}
              className="text-muted"
            />
            {state === "rejected" && fileName ? (
              <span className="text-small font-bold break-all text-ink">{fileName}</span>
            ) : state === "checking" ? (
              <span className="text-small font-bold text-ink">{words.checking}</span>
            ) : (
              <>
                <span className="text-small font-bold text-ink">{words.dropTitle}</span>
                <span className="text-caption text-muted">{words.dropText}</span>
              </>
            )}
          </span>
        )}
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={accept}
          disabled={locked}
          aria-labelledby={nameId}
          className="sr-only"
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            if (chosen) onFile(chosen);
            event.target.value = "";
          }}
        />
      </label>

      {look && status ? (
        <div
          role={look.role}
          className={cn("flex items-start gap-3 rounded-md p-3 text-small", look.box)}
        >
          <Icon icon={look.icon} size="sm" className={cn("mt-1 shrink-0", look.head)} />
          <div className="flex min-w-0 flex-col gap-1">
            <p className={cn("font-bold", look.head)}>{status.title}</p>
            <p className="text-ink">{status.text}</p>
          </div>
        </div>
      ) : null}
      {state === "checking" ? (
        <p role="status" className="text-small text-muted">
          {words.checking}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {state === "empty" ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={locked}
            aria-label={named(words.choose)}
            onClick={choose}
          >
            {words.choose}
          </Button>
        ) : null}
        {state === "filled" || state === "near" ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={locked}
            aria-label={named(words.replace)}
            onClick={choose}
          >
            {words.replace}
          </Button>
        ) : null}
        {state === "near" && onKeep ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={locked}
            aria-label={named(words.keep)}
            onClick={onKeep}
          >
            {words.keep}
          </Button>
        ) : null}
        {state === "filled" && onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={locked}
            aria-label={named(words.remove)}
            onClick={onRemove}
          >
            {words.remove}
          </Button>
        ) : null}
        {state === "rejected" ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={locked}
            aria-label={named(words.chooseAnother)}
            onClick={choose}
          >
            {words.chooseAnother}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export { SponsorImageSlot };
export type { SponsorImageSlotProps, SponsorImageSlotState, SponsorImageSlotWords };
