import type { CSSProperties } from "react";
import { Heading } from "@/components/ui/heading";

type Segment = { text: string; emphasis: boolean };
type Word = Segment[];

/**
 * Splits the headline into words, keeping the emphasised part (italic, as TitleWithEmphasis sets it)
 * and gluing punctuation to the word before it, so "Chennai." can never wrap as "Chennai" + ".".
 */
function wordsOf(title: string, emphasis: string | undefined): Word[] {
  const at = emphasis ? title.indexOf(emphasis) : -1;
  const parts: Segment[] =
    !emphasis || at < 0
      ? [{ text: title, emphasis: false }]
      : [
          { text: title.slice(0, at), emphasis: false },
          { text: emphasis, emphasis: true },
          { text: title.slice(at + emphasis.length), emphasis: false },
        ];
  const words: Word[] = [];
  let afterSpace = true;
  for (const part of parts) {
    for (const piece of part.text.split(/(\s+)/)) {
      if (piece === "") continue;
      if (/^\s+$/.test(piece)) {
        afterSpace = true;
        continue;
      }
      const last = words.at(-1);
      if (!afterSpace && last) last.push({ text: piece, emphasis: part.emphasis });
      else words.push([{ text: piece, emphasis: part.emphasis }]);
      afterSpace = false;
    }
  }
  return words;
}

/**
 * The headline, one word after another (the layered hero, D). Each word is its own box that rises
 * into place (.hl-word in src/styles/hero-lab.css); the spaces stay ordinary text, so the line
 * wraps and balances as before and a screen reader reads one plain sentence.
 */
export function WordReveal({ title, emphasis }: { title: string; emphasis?: string | undefined }) {
  const words = wordsOf(title, emphasis);
  return words.map((word, index) => (
    <span key={[index, ...word.map((segment) => segment.text)].join("-")}>
      {index > 0 ? " " : null}
      <span className="hl-word" style={{ "--hl-w": index } as CSSProperties}>
        {word.map((segment, at) =>
          segment.emphasis ? (
            <Heading.Em key={at}>{segment.text}</Heading.Em>
          ) : (
            <span key={at}>{segment.text}</span>
          ),
        )}
      </span>
    </span>
  ));
}
