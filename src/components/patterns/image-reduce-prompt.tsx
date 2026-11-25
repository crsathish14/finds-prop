/**
 * ImageReducePrompt: the message under an upload box when a chosen picture is still too heavy, and what follows it.
 * Purpose: the one place that asks "lower the quality to fit?", shows the result and lets the person accept it or choose
 *   another file. Owner: design system. It lowers nothing itself: the upload box passes the words, the state and the
 *   handlers, and works out the sizes. The flow it belongs to (owner, 25 Nov 2026): hidden data is taken out first
 *   with no loss of quality; only a picture that is still over the limit gets this prompt; the person decides.
 * Props: state ("offer" | "working" | "ready" | "failed"), title and text (already translated, with the sizes in them),
 *   words ({ reduce, use, chooseAnother }, already translated), preview ({ url, alt }, for "ready": the lowered
 *   picture), onReduce, onUse, onChooseAnother, ref (so the page can move focus here when the prompt appears), className.
 * Responsive: full width of its container; the picture sits beside the words and the buttons wrap on a narrow screen.
 * Accessibility: "offer" and "ready" are read politely, "failed" at once; each state has its own icon and a title, so
 *   colour is never the only signal; while working the box is marked busy and has no buttons; every button names what
 *   it does; the picture has a description. The box can take focus (tabIndex -1) so the page can move it here.
 * States: offer (asks), working (lowering the quality), ready (shows the result, asks), failed (explains, asks for
 *   another file). Buttons per state: offer = Reduce quality + Choose another; ready = Use this + Choose another;
 *   failed = Choose another; working = none.
 * Dependencies: Button, Icon, Spinner, cva, cn. Tests: image-reduce-prompt.test.tsx; Design Lab "Components" (Image
 *   size prompt).
 * UX reference: none drawn; follows the Alert (ds-feedback) with its tones and the Upload zone's picture preview.
 */
import { cva } from "class-variance-authority";
import { CircleAlert, CircleCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import Image from "next/image";
import type { Ref } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

const promptStyles = cva("flex flex-col gap-3 rounded-md border px-4 py-3 text-small", {
  variants: {
    state: {
      offer: "border-warning/30 bg-warning-tint text-warning",
      working: "border-info/30 bg-info-tint text-info",
      ready: "border-success/30 bg-success-tint text-success",
      failed: "border-danger/30 bg-danger-tint text-danger-text",
    },
  },
});

const STATE_ICONS: Partial<Record<ImageReducePromptState, LucideIcon>> = {
  offer: TriangleAlert,
  ready: CircleCheck,
  failed: CircleAlert,
};

type ImageReducePromptState = "offer" | "working" | "ready" | "failed";

type ImageReducePromptWords = {
  reduce: string;
  use: string;
  chooseAnother: string;
};

type ImageReducePromptProps = {
  state: ImageReducePromptState;
  title: string;
  text: string;
  words: ImageReducePromptWords;
  /** For "ready": the picture after its quality was lowered. */
  preview?: { url: string; alt: string };
  onReduce?: () => void;
  onUse?: () => void;
  onChooseAnother?: () => void;
  ref?: Ref<HTMLDivElement>;
  className?: string | undefined;
};

function ImageReducePrompt({
  state,
  title,
  text,
  words,
  preview,
  onReduce,
  onUse,
  onChooseAnother,
  ref,
  className,
}: ImageReducePromptProps) {
  const icon = STATE_ICONS[state];
  return (
    <div
      ref={ref}
      tabIndex={-1}
      data-slot="image-reduce-prompt"
      data-state={state}
      role={state === "failed" ? "alert" : "status"}
      aria-busy={state === "working" || undefined}
      className={cn(promptStyles({ state }), className)}
    >
      <div className="flex items-start gap-3">
        {icon ? <Icon icon={icon} className="mt-px" /> : <Spinner className="mt-px" />}
        <div className="min-w-0 flex-1">
          <p className="font-bold">{title}</p>
          <p className="font-medium">{text}</p>
        </div>
        {state === "ready" && preview ? (
          <Image
            src={preview.url}
            alt={preview.alt}
            width={80}
            height={80}
            unoptimized
            className="size-20 shrink-0 rounded-md border border-line bg-surface object-contain"
          />
        ) : null}
      </div>
      {state === "offer" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" size="sm" onClick={onReduce}>
            {words.reduce}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onChooseAnother}>
            {words.chooseAnother}
          </Button>
        </div>
      ) : null}
      {state === "ready" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" size="sm" onClick={onUse}>
            {words.use}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onChooseAnother}>
            {words.chooseAnother}
          </Button>
        </div>
      ) : null}
      {state === "failed" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" size="sm" onClick={onChooseAnother}>
            {words.chooseAnother}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export { ImageReducePrompt };
export type { ImageReducePromptProps, ImageReducePromptState, ImageReducePromptWords };
