import {
  BLOCKS_MAX,
  BLOG_ALT_MAX,
  HEADING_MAX,
  LIST_ITEMS_MAX,
  LIST_ITEM_MAX,
  PARAGRAPH_MAX,
  QUOTE_CITE_MAX,
  QUOTE_MAX,
} from "../constants";

/**
 * The prompt a writer pastes into any AI assistant, with their article, to get back Markdown the paste flow accepts
 * (ADR-173). It is code and not a translated message because it is an instruction to a machine, in English, whatever
 * language the admin screen is in. Every limit in it is read from the same constants the converter and the database
 * use, so the prompt cannot drift from the rules; a test converts the example below with no change reported.
 */

const number = (value: number): string => value.toLocaleString("en-US");

/** A short article in exactly the format the prompt asks for. Also what the test converts. */
export const AI_PROMPT_EXAMPLE = `# Five things to check before you buy a flat

Buying a home is a big decision. Read the [RERA registration page](https://rera.example.gov.in/projects) of the project first.

![The front gate of the project](IMAGE-1)

## Check the paperwork

- The title deed
- The approved plan
- The [occupancy certificate](https://example.com/occupancy)

### Ask the builder

1. When will you hand over the flat?
2. What is included in the price?

> A good home is worth the wait.
> — A happy buyer

Read more on [our guides page](/blog).`;

export function buildAiPrompt(): string {
  return `You are converting a blog article into the Markdown format that the FindsProp website accepts. Follow every rule below exactly.

OUTPUT
- Reply with ONLY the finished Markdown, inside one code block so it can be copied in one click. Write nothing before or after it: no greeting, no explanation, no notes.
- Keep the author's words. Do not rewrite, shorten, summarise or add anything. Only change the formatting.

STRUCTURE
- The first line is the article title as "# Title": one # and a space. Use a single # line in the whole article. The title is at most ${HEADING_MAX} characters.
- Section headings are "## Heading", and "### Heading" for a smaller one inside a section. Always put a space after the hashes. Never use #### or deeper. A heading is at most ${HEADING_MAX} characters and holds no link.
- Paragraphs are plain text with one blank line between them. A paragraph is at most ${number(PARAGRAPH_MAX)} characters.
- Bullet lists: one item per line starting with "- ". Numbered lists: "1. ", "2. ", and so on. Never put a list inside another list; flatten it. An item is at most ${LIST_ITEM_MAX} characters and a list has at most ${LIST_ITEMS_MAX} items.
- Quotes: start every line with "> ". If the speaker is named, make the last line "> — Name" (at most ${QUOTE_CITE_MAX} characters). A quote is at most ${number(QUOTE_MAX)} characters.
- Do NOT use tables, code blocks, horizontal lines (---), HTML, bold, italic, strike-through or inline code. They are not supported. Write a table as a bullet list with one item per row, and write emphasised words as plain words.
- The whole article is at most ${BLOCKS_MAX} blocks (every heading, paragraph, list, quote and picture is one block). If the original has more, join very short neighbouring paragraphs.

LINKS
- Keep every link the original has, on exactly the same words: [the words](https://example.com/page).
- An address must start with https:// and have a dot in the website name, or be a page of this website that starts with one / (for example /blog). Anything else (http://, mailto:, tel:, #anchors, relative addresses) is not accepted: for those, keep only the words and drop the link.
- Never invent, guess or change an address. The words of a link are at most 160 characters and have no ( ) [ ] inside them.
- Links go in paragraphs, list items and quotes only. In a heading, keep the words and drop the link.

PICTURES
- Wherever the original has a picture, write one line of its own, with a blank line before and after it: ![what the picture shows](IMAGE-1)
- Number the pictures in the order they appear: IMAGE-1, IMAGE-2, IMAGE-3. Always write IMAGE-1, IMAGE-2 and so on as the address. Never write the picture's real address or file name.
- What the picture shows is plain words, at most ${BLOG_ALT_MAX} characters, with no [ ] ( ) inside. It is read aloud to people who cannot see the picture, so describe it.
- Do not invent pictures the original does not have. If a picture was also a link, keep only the picture line.

EXAMPLE OF THE FORMAT
\`\`\`
${AI_PROMPT_EXAMPLE}
\`\`\`

THE ARTICLE TO CONVERT (everything below this line)

`;
}
