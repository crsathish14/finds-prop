import { Fragment, type ReactNode } from "react";

// No message in en.json contains this, so a marker is never mistaken for the visitor's words.
const MARKER = "%%";

/** What to pass for a named variable of a message that holds a link or other markup. */
export const marker = (name: string) => `${MARKER}${name}${MARKER}`;

/**
 * A sentence that holds links stays one message with named variables (ADR-035: whole sentences, no
 * HTML). The screen passes each variable as a marker, and the markers are swapped for the real
 * elements here.
 */
export function withLinks(sentence: string, elements: Record<string, ReactNode>): ReactNode[] {
  return sentence
    .split(new RegExp(`${MARKER}([A-Za-z]+)${MARKER}`))
    .map((part, index) =>
      index % 2 === 1 ? <Fragment key={part}>{elements[part]}</Fragment> : part,
    );
}
