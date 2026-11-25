"use client";

/**
 * ImageReduceFlow: the words and sizes of the "lower the quality to fit?" prompt, for any upload box.
 * Purpose: one place that turns the state of `useImageReduce` into the approved prompt (ImageReducePrompt) with its
 *   words from en.json and its sizes written the same way everywhere ("2.3 MB", "430 KB"). Owner: design system. It lowers
 *   nothing: the upload box owns the hook and passes what the hook gives, and says what "Choose another" does (usually
 *   opening its file picker again).
 * Props: prompt (what `useImageReduce` gives, or null: then nothing is drawn), onReduce, onUse, onChooseAnother,
 *   className.
 * Responsive: that of ImageReducePrompt (full width of its container; the buttons wrap on a narrow screen).
 * Accessibility: that of ImageReducePrompt, and when the state changes the prompt takes focus, so a keyboard or screen
 *   reader user lands on the question and then on the result.
 * States: none of its own; offer, working, ready and failed (three kinds) come from the prompt.
 * Dependencies: ImageReducePrompt, formatFileSize. Tests: image-reduce-flow.test.tsx; Design Lab "Components" (Image size
 *   prompt) shows the states it draws.
 * UX reference: none drawn; the owner approved the prompt's states and words on 25 Nov 2026.
 */
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { ImageReducePrompt } from "@/components/patterns/image-reduce-prompt";
import { formatFileSize, type Translate } from "@/lib/format";
import type { ImagePrompt } from "@/lib/use-image-reduce";

type ImageReduceFlowProps = {
  prompt: ImagePrompt | null;
  onReduce: () => void;
  onUse: () => void;
  onChooseAnother: () => void;
  className?: string;
};

function ImageReduceFlow({
  prompt,
  onReduce,
  onUse,
  onChooseAnother,
  className,
}: ImageReduceFlowProps) {
  const translate = useTranslations("imageReduce");
  const everything = useTranslations() as unknown as Translate;
  const locale = useLocale();
  const box = useRef<HTMLDivElement>(null);
  const state = prompt?.state;

  // The question, then the result, are put in front of the person: focus moves to the prompt when its state changes.
  useEffect(() => {
    if (state) box.current?.focus();
  }, [state]);

  if (!prompt) return null;
  const size = (bytes: number) => formatFileSize(everything, locale, bytes);
  const words = {
    reduce: translate("reduce"),
    use: translate("use"),
    chooseAnother: translate("chooseAnother"),
  };
  const common = { words, onReduce, onUse, onChooseAnother, ref: box, className };

  if (prompt.state === "offer") {
    return (
      <ImageReducePrompt
        state="offer"
        title={translate("offer.title")}
        text={translate("offer.text", { size: size(prompt.bytes), limit: size(prompt.limitBytes) })}
        {...common}
      />
    );
  }
  if (prompt.state === "working") {
    return (
      <ImageReducePrompt
        state="working"
        title={translate("working.title")}
        text={translate("working.text")}
        {...common}
      />
    );
  }
  if (prompt.state === "ready") {
    return (
      <ImageReducePrompt
        state="ready"
        title={translate("ready.title")}
        text={translate("ready.text", {
          after: size(prompt.reducedBytes),
          before: size(prompt.bytes),
        })}
        preview={{ url: prompt.previewUrl, alt: translate("previewAlt") }}
        {...common}
      />
    );
  }
  if (prompt.reason === "cannot_fit") {
    return (
      <ImageReducePrompt
        state="failed"
        title={translate("failed.cannotFit.title")}
        text={translate("failed.cannotFit.text", {
          smallest: size(prompt.smallestBytes ?? prompt.bytes),
          limit: size(prompt.limitBytes),
        })}
        {...common}
      />
    );
  }
  if (prompt.reason === "no_encoder") {
    return (
      <ImageReducePrompt
        state="failed"
        title={translate("failed.noEncoder.title")}
        text={translate("failed.noEncoder.text")}
        {...common}
      />
    );
  }
  return (
    <ImageReducePrompt
      state="failed"
      title={translate("failed.other.title")}
      text={translate("failed.other.text")}
      {...common}
    />
  );
}

export { ImageReduceFlow };
export type { ImageReduceFlowProps };
