/**
 * BlogBlocks: the body of a Blog article, drawn from its blocks.
 * Purpose: ADR-143 and ADR-144 store an article as a list of blocks (heading, paragraph, list, quote, image) and never as
 *   HTML. This draws them as the page's own elements, so the text is always React text and nothing the admin typed
 *   can become markup (R-SEC-10). Owner: design system. It holds no state and fetches nothing.
 * Props: blocks (the article's blocks; the shapes are the ones in features/blog), imageUrl (turns a stored picture path
 *   into the address it is shown from), sizes (next/image `sizes` for a picture; the default fits the article column),
 *   priorityImage (the first picture is the first thing seen: load it early), className. A block of a kind it does
 *   not know is left out, never drawn as text.
 * Responsive: one column about 68 characters wide, centred, at every width; a picture is the width of the column and
 *   keeps a 16 : 10 shape; long words wrap instead of widening the page.
 * Accessibility: headings are level 2 and 3 (the article's title is the level 1, so the outline never skips a level);
 *   lists are real ul and ol lists; a quote is a blockquote with its credit in a cite element; a picture has the
 *   description the admin wrote as its alt text and an optional caption in a figcaption; paragraph line breaks are kept.
 * States: empty (nothing is drawn), each block kind, a picture missing or failed (illustrated tile).
 * Dependencies: CardCover, cn. Tests: blog-parts.test.tsx; Design Lab "Blog article parts" (ADR-143).
 * UX reference: none yet; drawn for the owner's approval (the Blog article page, ADR-143 section 4).
 */
import { cn } from "@/lib/cn";
import { CardCover } from "./property-card-controls.client";

type BlogBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: readonly string[] }
  | { type: "quote"; text: string; cite?: string | undefined }
  | { type: "image"; path: string; alt: string; caption?: string | undefined };

type BlogBlocksProps = {
  blocks: readonly BlogBlock[];
  imageUrl: (path: string) => string;
  sizes?: string;
  priorityImage?: boolean;
  className?: string;
};

const DEFAULT_SIZES = "(min-width: 1024px) 720px, 100vw";

function BlogBlocks({
  blocks,
  imageUrl,
  sizes = DEFAULT_SIZES,
  priorityImage = false,
  className,
}: BlogBlocksProps) {
  const firstImage = blocks.findIndex((block) => block.type === "image");
  return (
    <div
      data-slot="blog-blocks"
      className={cn("mx-auto flex w-full max-w-prose min-w-0 flex-col gap-5 text-ink", className)}
    >
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        switch (block.type) {
          case "heading": {
            const Level = block.level === 2 ? "h2" : "h3";
            return (
              <Level
                key={key}
                className={cn(
                  "mt-4 text-primary [overflow-wrap:anywhere]",
                  block.level === 2 ? "text-h2" : "text-h3",
                )}
              >
                {block.text}
              </Level>
            );
          }
          case "paragraph":
            return (
              <p key={key} className="text-body whitespace-pre-line [overflow-wrap:anywhere]">
                {block.text}
              </p>
            );
          case "list": {
            const List = block.ordered ? "ol" : "ul";
            return (
              <List
                key={key}
                className={cn(
                  "flex flex-col gap-2 pl-6 text-body",
                  block.ordered ? "list-decimal" : "list-disc",
                )}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`} className="[overflow-wrap:anywhere]">
                    {item}
                  </li>
                ))}
              </List>
            );
          }
          case "quote":
            return (
              <blockquote
                key={key}
                className="flex flex-col gap-2 border-l-4 border-cta bg-canvas-sunken px-5 py-4"
              >
                <p className="text-lead whitespace-pre-line [overflow-wrap:anywhere]">
                  {block.text}
                </p>
                {block.cite ? (
                  <cite className="text-small text-muted not-italic">{block.cite}</cite>
                ) : null}
              </blockquote>
            );
          case "image": {
            const priority = priorityImage && index === firstImage;
            return (
              <figure key={key} className="flex flex-col gap-2">
                <div className="relative aspect-16/10 overflow-hidden rounded-lg bg-canvas-sunken">
                  <CardCover
                    src={imageUrl(block.path)}
                    alt={block.alt}
                    sizes={sizes}
                    priority={priority}
                  />
                </div>
                {block.caption ? (
                  <figcaption className="text-caption text-muted">{block.caption}</figcaption>
                ) : null}
              </figure>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}

export { BlogBlocks };
export type { BlogBlock };
