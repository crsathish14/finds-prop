"use client";

import { useState } from "react";
import {
  BlogMarkdownFlow,
  type MarkdownCreateResult,
} from "@/components/domain/blog-markdown-flow";
import { BlogMethodChooser } from "@/components/domain/blog-markdown-flow-chooser";
import { extensionOf, pictureProblem, PICTURE_ACCEPT } from "@/features/blog/blog-pictures";
import { buildAiPrompt } from "@/features/blog/markdown/ai-prompt";
import { convertMarkdown } from "@/features/blog/markdown/convert";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";

const PICTURE_RULES = {
  accept: PICTURE_ACCEPT,
  problem: pictureProblem,
  extension: extensionOf,
  maximumKb: 500,
};
const AI_PROMPT = buildAiPrompt();

const CATEGORIES = [
  { id: "guides", name: "Guides" },
  { id: "news", name: "News" },
];

/** The shape of article people paste: a title, an intro, sections, lists, a quote, a link, a hashtag line and a table. */
const SAMPLE = `# How to check a plot before you buy it in Chennai

Buying land is a big decision. Here is **a short guide** to the papers you should ask for.

![A buyer reading the sale papers](IMAGE-1)

## What to ask the seller

- The *parent* document
- The latest [encumbrance certificate](https://www.tnreginet.gov.in/portal)
- Patta and chitta

## The steps

1. Visit the sub-registrar's office
2. Check the survey number
3. Pay the fee

> Never pay in cash without a receipt.
> — A Chennai property lawyer

| Paper | Where |
| ----- | ----- |
| EC | Sub-registrar |

#realestate #chennai #plots
`;

const PROBLEMS = `# A very long list of headings

## ${"A heading that is far too long to be a heading. ".repeat(5)}

Some words.
`;

const stay = (): Promise<MarkdownCreateResult> => new Promise(() => undefined);

/** The flow with a few lines already pasted. `onCreate` answers after a moment, so a click shows the working state. */
function FlowTryIt({ start, refuse = false }: { start: string; refuse?: boolean }) {
  const [message, setMessage] = useState("");
  return (
    <div className="flex w-full max-w-6xl flex-col gap-3">
      <PreFilled start={start} refuse={refuse} onResult={setMessage} />
      {message ? <Text tone="muted">{message}</Text> : null}
    </div>
  );
}

function PreFilled({
  start,
  refuse,
  onResult,
}: {
  start: string;
  refuse: boolean;
  onResult: (message: string) => void;
}) {
  return (
    <BlogMarkdownFlow
      categories={CATEGORIES}
      convert={convertMarkdown}
      aiPrompt={AI_PROMPT}
      pictureRules={PICTURE_RULES}
      backHref="/design-lab"
      debounceMs={0}
      headingAs="h2"
      defaultMarkdown={start}
      onCreate={async (input) => {
        if (refuse) {
          return {
            ok: false,
            errors: { slug: "This address is already used by another article." },
          };
        }
        onResult(`Would create the draft "${input.title}" by ${input.authorName}.`);
        return { ok: true };
      }}
    />
  );
}

export function BlogMarkdownFlowDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The second way to start an article (ADR-172): paste Markdown written elsewhere, see it drawn
        exactly as readers will, read the list of what the conversion changed, confirm the title,
        address, summary, author and category, and create a draft that opens in the block editor.
        ADR-173 adds a prompt to copy into any AI tool, an Add a link button in the paste box, and a
        place for each picture (a line like IMAGE-1) with its own file chooser. The pasted text is
        not stored. All wording is draft wording for the owner to approve.
      </Text>
      <Specimen label="Empty: a gentle note, nothing to create">
        <FlowTryIt start="" />
      </Specimen>
      <Specimen label="A pasted article (edit the text; the preview and the changes follow)">
        <FlowTryIt start={SAMPLE} />
      </Specimen>
      <Specimen label="With a problem that stops the draft: a heading over 160 characters">
        <FlowTryIt start={PROBLEMS} />
      </Specimen>
      <Specimen label="A refused save: the address is already used">
        <FlowTryIt start={SAMPLE} refuse />
      </Specimen>
      <Specimen label="Saving: the button says it is working (click Create draft after typing an author name)">
        <div className="w-full max-w-6xl">
          <BlogMarkdownFlow
            categories={CATEGORIES}
            convert={convertMarkdown}
            aiPrompt={AI_PROMPT}
            pictureRules={PICTURE_RULES}
            backHref="/design-lab"
            debounceMs={0}
            headingAs="h2"
            defaultMarkdown={SAMPLE}
            onCreate={stay}
          />
        </div>
      </Specimen>
    </div>
  );
}

export function BlogMethodChooserDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The first step of a new article (ADR-172): the block editor or pasted Markdown. Both stay
        while the owner tries them, and one will be removed. All wording is draft wording for the
        owner to approve.
      </Text>
      <Specimen label="The two cards (a phone shows them one above the other)">
        <BlogMethodChooser blocksHref="#blocks" markdownHref="#markdown" />
      </Specimen>
    </div>
  );
}
