import { stripLinks } from "@/lib/inline-links";
import type { Block } from "./schemas";

/**
 * The plain text of an article body, in reading order: each block's text, a quote's credit, an image's caption and its
 * description, and each list item (ADR-144). It matches the database's `blog_body_text`, which feeds the search, so a
 * word found by the search is a word this returns. A link `[label](address)` in a paragraph, a list item or a quote
 * counts as its label only (ADR-169): the address is never searched, counted, shown in a snippet or sent to the AI. The AI assistant's article tool (a later phase) reads the same text.
 * Pure: no framework, no storage.
 */
export function blocksToPlainText(blocks: readonly Block[]): string {
  const pieces: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        pieces.push(block.text);
        break;
      case "paragraph":
        pieces.push(stripLinks(block.text));
        break;
      case "quote":
        pieces.push(stripLinks(block.text));
        if (block.cite) pieces.push(block.cite);
        break;
      case "image":
        if (block.caption) pieces.push(block.caption);
        pieces.push(block.alt);
        break;
      case "list":
        pieces.push(...block.items.map(stripLinks));
        break;
    }
  }
  return pieces.join(" ");
}

/** About 200 words a minute, never less than one minute: the same as the database's `read_minutes`. */
export function readMinutesOf(blocks: readonly Block[]): number {
  const text = blocksToPlainText(blocks).trim();
  const words = text === "" ? 0 : text.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** The blocks that are pictures, in order: each is a file that must exist in the article's folder. */
export function imagePathsOf(blocks: readonly Block[]): string[] {
  const paths: string[] = [];
  for (const block of blocks) if (block.type === "image") paths.push(block.path);
  return paths;
}

/**
 * The first part of an article as plain text, cut at a word, for a card or a meta description when the admin wrote
 * no excerpt. Never longer than `max` characters, with an ellipsis when cut.
 */
export function excerptFromBlocks(blocks: readonly Block[], max = 160): string {
  const text = blocksToPlainText(blocks).replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
