"use client";

import { useEffect, useState } from "react";
import {
  ImageReducePrompt,
  type ImageReducePromptWords,
} from "@/components/patterns/image-reduce-prompt";
import { Button } from "@/components/ui/button";
import { Column, Specimen } from "../frame";

const NOTHING = () => undefined;

/** The words are shown here for the owner to read and approve; they move to en.json when a form uses the prompt. */
const WORDS: ImageReducePromptWords = {
  reduce: "Reduce quality",
  use: "Use this picture",
  chooseAnother: "Choose another",
};

const PICTURE = {
  url: "/design-lab/listings/home-a.svg",
  alt: "The picture after its quality was lowered",
};

const OFFER = {
  title: "This picture is still too heavy",
  text: "The hidden data is already removed, but it is 2.3 MB and the limit is 500 KB. Lower its quality to fit?",
};
const WORKING = { title: "Lowering the quality", text: "This takes a few seconds." };
const READY = {
  title: "Quality lowered",
  text: "Now 430 KB, down from 2.3 MB. The picture keeps its size in pixels. Look at it, then use it or choose another.",
};
const CANNOT_FIT = {
  title: "This picture cannot be made light enough",
  text: "Even at the lowest quality we allow it is 620 KB, and the limit is 500 KB. Choose a lighter picture.",
};
const NO_ENCODER = {
  title: "This browser cannot lower the quality of this picture",
  text: "Choose another file, or open the page in a different browser.",
};

/** The flow to press through, then every state of the prompt, one after the other. */
export function ImageReducePromptDemo() {
  return (
    <Column className="max-w-xl">
      <Specimen
        label="The flow: press the buttons (nothing is lowered or saved)"
        className="w-full"
      >
        <ImageReducePromptFlow />
      </Specimen>
      <Specimen
        label="Offer: still over the limit after the hidden data was removed"
        className="w-full"
      >
        <ImageReducePrompt
          state="offer"
          {...OFFER}
          words={WORDS}
          onReduce={NOTHING}
          onChooseAnother={NOTHING}
          className="w-full"
        />
      </Specimen>
      <Specimen label="Working: the browser is lowering the quality" className="w-full">
        <ImageReducePrompt state="working" {...WORKING} words={WORDS} className="w-full" />
      </Specimen>
      <Specimen label="Ready: the result, for the person to judge" className="w-full">
        <ImageReducePrompt
          state="ready"
          {...READY}
          words={WORDS}
          preview={PICTURE}
          onUse={NOTHING}
          onChooseAnother={NOTHING}
          className="w-full"
        />
      </Specimen>
      <Specimen label="Failed: even the lowest quality is too heavy" className="w-full">
        <ImageReducePrompt
          state="failed"
          {...CANNOT_FIT}
          words={WORDS}
          onChooseAnother={NOTHING}
          className="w-full"
        />
      </Specimen>
      <Specimen
        label="Failed: the browser cannot make this kind of picture lighter"
        className="w-full"
      >
        <ImageReducePrompt
          state="failed"
          {...NO_ENCODER}
          words={WORDS}
          onChooseAnother={NOTHING}
          className="w-full"
        />
      </Specimen>
    </Column>
  );
}

type Step = "offer" | "working" | "ready" | "used";

/** The same prompt as it will behave: Reduce quality, a short wait, then the result to accept or leave. */
function ImageReducePromptFlow() {
  const [step, setStep] = useState<Step>("offer");

  useEffect(() => {
    if (step !== "working") return undefined;
    const timer = window.setTimeout(() => setStep("ready"), 1200);
    return () => window.clearTimeout(timer);
  }, [step]);

  if (step === "used") {
    return (
      <div className="flex max-w-xl flex-col items-start gap-3">
        <p className="text-small text-muted">The picture goes on to upload (430 KB).</p>
        <Button type="button" variant="secondary" size="sm" onClick={() => setStep("offer")}>
          Start again
        </Button>
      </div>
    );
  }
  const copy = step === "offer" ? OFFER : step === "working" ? WORKING : READY;
  return (
    <ImageReducePrompt
      state={step}
      {...copy}
      words={WORDS}
      preview={PICTURE}
      onReduce={() => setStep("working")}
      onUse={() => setStep("used")}
      onChooseAnother={() => setStep("offer")}
      className="w-full max-w-xl"
    />
  );
}
