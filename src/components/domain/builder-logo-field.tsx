/**
 * BuilderLogoField: the logo box of a builder's Company profile, with its picture and its buttons.
 * Purpose: lets a builder or an agent upload the logo the Developer Spotlight shows (ADR-179). Owner: design system.
 *   It uploads nothing itself: the page passes `onFile` and says what came of it through `state` and `error`. With
 *   no logo the box shows the company's initials, as the spotlight does.
 * Props: initials (the letters shown with no logo), src (the logo's address, or null), state ("idle" | "uploading"),
 *   error (a sentence under the box, or nothing), words ({ title, hint, choose, replace, remove, uploading, alt }, all
 *   already translated), accept, onFile, onRemove, disabled, inputRef (so the page can open the file picker again, for
 *   "Choose another" after a picture was too heavy), className.
 * Responsive: the square sits beside the words and buttons, which wrap under it on a narrow screen.
 * Accessibility: the file picker is a real input reached by its button; the buttons name what they do; the error is an
 *   alert with an icon, never colour alone; while uploading the box is marked busy and nothing can be pressed.
 * States: no logo (initials), a logo, uploading, an error, disabled.
 * Dependencies: Button, Icon, cn. Tests: builder-parts.test.tsx; Design Lab "Admin" (Builder logo).
 * UX reference: none drawn; follows the admin-sponsors screen's picture slot (.slot) and the Developer Spotlight
 *   concept (sponsor ads plan, 23 Nov 2026).
 */
import { CircleX, Upload } from "lucide-react";
import { useId, useRef, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type BuilderLogoFieldWords = {
  title: string;
  hint: string;
  choose: string;
  replace: string;
  remove: string;
  uploading: string;
  alt: string;
};

type BuilderLogoFieldProps = {
  initials: string;
  src: string | null;
  state?: "idle" | "uploading";
  error?: string | undefined;
  words: BuilderLogoFieldWords;
  accept?: string;
  onFile: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
  /** The page's own handle on the file input, to open the picker from outside. */
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
};

function BuilderLogoField({
  initials,
  src,
  state = "idle",
  error,
  words,
  accept = "image/jpeg,image/png,image/webp",
  onFile,
  onRemove,
  disabled = false,
  inputRef,
  className,
}: BuilderLogoFieldProps) {
  const inputId = useId();
  const ownInput = useRef<HTMLInputElement>(null);
  const input = inputRef ?? ownInput;
  const busy = state === "uploading";
  const locked = disabled || busy;

  return (
    <div
      data-slot="builder-logo-field"
      aria-busy={busy || undefined}
      className={cn("flex flex-col gap-3", className)}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="font-bold text-ink">
          {words.title}
        </label>
        <p className="text-small text-muted">{words.hint}</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <span
          className={cn(
            "grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border bg-canvas-sunken",
            error ? "border-danger" : "border-line",
          )}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- a small uploaded logo of any shape, shown whole
            <img src={src} alt={words.alt} className="size-full object-contain p-2" />
          ) : (
            <span aria-hidden="true" className="text-h3 text-primary">
              {initials}
            </span>
          )}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={locked}
            loading={busy}
            iconStart={<Icon icon={Upload} size="sm" />}
            onClick={() => input.current?.click()}
          >
            {busy ? words.uploading : src ? words.replace : words.choose}
          </Button>
          {src && !busy ? (
            <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={onRemove}>
              {words.remove}
            </Button>
          ) : null}
        </div>
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={accept}
          disabled={locked}
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            if (chosen) onFile(chosen);
            event.target.value = "";
          }}
        />
      </div>
      {error ? (
        <p role="alert" className="flex items-start gap-2 text-small text-danger-text">
          <Icon icon={CircleX} size="sm" className="mt-1 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export { BuilderLogoField };
export type { BuilderLogoFieldProps, BuilderLogoFieldWords };
