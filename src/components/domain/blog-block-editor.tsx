"use client";

/**
 * BlogBlockEditor: the editor of an article's body, block by block.
 * Purpose: ADR-143 and ADR-144 store an article as blocks (heading, paragraph, list, quote, image). This lets the admin add a
 *   block of each kind, write its fields, move it up or down and delete it, with no markup to learn. Owner: design
 *   system. It keeps nothing but what the person is typing into a box: the page keeps the blocks and passes the
 *   words, and the connected page decides how a picture is chosen and sent.
 * Props: blocks (the body now), onChange (the new body), imageUrl (the address a stored picture path is shown from),
 *   onChooseImage (called with the block's place when the person asks to choose or replace its picture; the page then
 *   sets the block's `path`), errors (a message for a block by its place, already translated), max (how many blocks
 *   the article may hold, default 100), disabled, className. A heading is level 2 or 3, a list is bulleted or numbered
 *   and takes one item a line, a quote may have a credit, a paragraph, a list and a quote have an "Add link" control
 *   (ADR-169), a heading says the article's title is already the page's main heading, a picture has a required description and an optional caption.
 * Responsive: one column of cards at every width; the Add buttons wrap; the move and delete buttons keep 44 px targets.
 * Accessibility: each block is a group named by its kind and place ("Block 2: Paragraph"); every button says which block
 *   it acts on ("Move block 2 up"); the first block's Up and the last block's Down are disabled; a block that is
 *   deleted or moved keeps focus on the same kind of button; an error is a message tied to its box; a full list says
 *   so in words and turns the Add buttons off.
 * States: empty, each kind of block, a picture not chosen yet, a picture chosen, an error on a block, first, last, full,
 *   disabled (while saving).
 * Dependencies: BlogLinkTextField, FormField, Input, Button, IconButton, SegmentedControl, CardCover, Icon, next-intl.
 * Tests: blog-editor.test.tsx; Design Lab "Blog block editor" (ADR-143).
 * UX reference: none yet; drawn for the owner's approval (the Blog editor, ADR-143 section 5).
 */
import {
  ArrowDown,
  ArrowUp,
  Heading2,
  Image as ImageIcon,
  List,
  Pilcrow,
  Quote,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/cn";
import type { BlogBlock } from "./blog-blocks";
import { BlogLinkTextField } from "./blog-link-text-field";
import { CardCover } from "./property-card-controls.client";

type BlockKind = BlogBlock["type"];

type BlogBlockEditorProps = {
  blocks: readonly BlogBlock[];
  onChange: (blocks: BlogBlock[]) => void;
  imageUrl: (path: string) => string;
  onChooseImage: (index: number) => void;
  errors?: Readonly<Record<number, string>>;
  max?: number;
  disabled?: boolean;
  className?: string;
};

const KINDS: readonly { kind: BlockKind; icon: LucideIcon }[] = [
  { kind: "heading", icon: Heading2 },
  { kind: "paragraph", icon: Pilcrow },
  { kind: "list", icon: List },
  { kind: "quote", icon: Quote },
  { kind: "image", icon: ImageIcon },
];

/** The words of each kind (static keys, so the messages check can see them). */
const KIND_WORDS = {
  heading: "admin.blog.editor.kinds.heading",
  paragraph: "admin.blog.editor.kinds.paragraph",
  list: "admin.blog.editor.kinds.list",
  quote: "admin.blog.editor.kinds.quote",
  image: "admin.blog.editor.kinds.image",
} as const satisfies Record<BlockKind, string>;

const ADD_WORDS = {
  heading: "admin.blog.editor.add.heading",
  paragraph: "admin.blog.editor.add.paragraph",
  list: "admin.blog.editor.add.list",
  quote: "admin.blog.editor.add.quote",
  image: "admin.blog.editor.add.image",
} as const satisfies Record<BlockKind, string>;

/** What a new block of each kind starts as. */
function emptyBlock(kind: BlockKind): BlogBlock {
  switch (kind) {
    case "heading":
      return { type: "heading", level: 2, text: "" };
    case "paragraph":
      return { type: "paragraph", text: "" };
    case "list":
      return { type: "list", ordered: false, items: [""] };
    case "quote":
      return { type: "quote", text: "" };
    case "image":
      return { type: "image", path: "", alt: "" };
  }
}

function BlogBlockEditor({
  blocks,
  onChange,
  imageUrl,
  onChooseImage,
  errors = {},
  max = 100,
  disabled = false,
  className,
}: BlogBlockEditorProps) {
  const translate = useTranslations();
  const full = blocks.length >= max;

  const replace = (index: number, block: BlogBlock) =>
    onChange(blocks.map((existing, place) => (place === index ? block : existing)));
  const remove = (index: number) => onChange(blocks.filter((_, place) => place !== index));
  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const moved = next[index];
    const other = next[target];
    if (!moved || !other) return;
    next[index] = other;
    next[target] = moved;
    onChange(next);
  };

  return (
    <div data-slot="blog-block-editor" className={cn("flex min-w-0 flex-col gap-4", className)}>
      {blocks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong bg-canvas-sunken p-5 text-small text-muted">
          {translate("admin.blog.editor.empty")}
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {blocks.map((block, index) => {
            const place = index + 1;
            const kind = translate(KIND_WORDS[block.type]);
            const error = errors[index];
            return (
              <li key={index}>
                <div
                  role="group"
                  aria-label={translate("admin.blog.editor.blockLabel", { place, kind })}
                  className="flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-surface p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-overline text-muted">{`${place}. ${kind}`}</p>
                    <div className="flex items-center">
                      <IconButton
                        type="button"
                        aria-label={translate("admin.blog.editor.moveUp", { place })}
                        disabled={disabled || index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <Icon icon={ArrowUp} />
                      </IconButton>
                      <IconButton
                        type="button"
                        aria-label={translate("admin.blog.editor.moveDown", { place })}
                        disabled={disabled || index === blocks.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <Icon icon={ArrowDown} />
                      </IconButton>
                      <IconButton
                        type="button"
                        aria-label={translate("admin.blog.editor.remove", { place })}
                        disabled={disabled}
                        onClick={() => remove(index)}
                      >
                        <Icon icon={Trash2} />
                      </IconButton>
                    </div>
                  </div>
                  <BlockFields
                    block={block}
                    place={place}
                    error={error}
                    disabled={disabled}
                    imageUrl={imageUrl}
                    onChange={(next) => replace(index, next)}
                    onChooseImage={() => onChooseImage(index)}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex flex-col gap-2">
        <p className="text-small font-semibold text-ink">
          {translate("admin.blog.editor.addTitle")}
        </p>
        <div className="flex flex-wrap gap-2">
          {KINDS.map(({ kind, icon }) => (
            <Button
              key={kind}
              type="button"
              variant="secondary"
              size="sm"
              iconStart={<Icon icon={icon} />}
              disabled={disabled || full}
              onClick={() => onChange([...blocks, emptyBlock(kind)])}
            >
              {translate(ADD_WORDS[kind])}
            </Button>
          ))}
        </div>
        <p className="text-caption text-muted" aria-live="polite">
          {full
            ? translate("admin.blog.editor.full", { max })
            : translate("admin.blog.editor.count", { count: blocks.length, max })}
        </p>
      </div>
    </div>
  );
}

type BlockFieldsProps = {
  block: BlogBlock;
  place: number;
  error: string | undefined;
  disabled: boolean;
  imageUrl: (path: string) => string;
  onChange: (block: BlogBlock) => void;
  onChooseImage: () => void;
};

function BlockFields({
  block,
  place,
  error,
  disabled,
  imageUrl,
  onChange,
  onChooseImage,
}: BlockFieldsProps) {
  const translate = useTranslations();
  const problem = error ? { error } : {};

  if (block.type === "heading") {
    return (
      <div className="flex flex-col gap-4">
        <SegmentedControl
          aria-label={translate("admin.blog.editor.headingLevel", { place })}
          size="sm"
          value={String(block.level)}
          onValueChange={(value) => onChange({ ...block, level: value === "3" ? 3 : 2 })}
          options={[
            { value: "2", label: translate("admin.blog.editor.level2") },
            { value: "3", label: translate("admin.blog.editor.level3") },
          ]}
        />
        <FormField
          label={translate("admin.blog.editor.headingText")}
          hint={translate("admin.blog.editor.headingHint")}
          {...problem}
        >
          <Input
            value={block.text}
            disabled={disabled}
            maxLength={160}
            onChange={(event) => onChange({ ...block, text: event.target.value })}
          />
        </FormField>
      </div>
    );
  }

  if (block.type === "paragraph") {
    return (
      <BlogLinkTextField
        label={translate("admin.blog.editor.paragraphText")}
        hint={translate("admin.blog.editor.linkHint")}
        value={block.text}
        disabled={disabled}
        maxLength={5000}
        place={place}
        error={error}
        onValueChange={(text) => onChange({ ...block, text })}
      />
    );
  }

  if (block.type === "list") {
    return (
      <div className="flex flex-col gap-4">
        <SegmentedControl
          aria-label={translate("admin.blog.editor.listKind", { place })}
          size="sm"
          value={block.ordered ? "numbered" : "bulleted"}
          onValueChange={(value) => onChange({ ...block, ordered: value === "numbered" })}
          options={[
            { value: "bulleted", label: translate("admin.blog.editor.bulleted") },
            { value: "numbered", label: translate("admin.blog.editor.numbered") },
          ]}
        />
        <BlogLinkTextField
          label={translate("admin.blog.editor.listItems")}
          hint={translate("admin.blog.editor.listHint")}
          value={block.items.join("\n")}
          disabled={disabled}
          place={place}
          error={error}
          onValueChange={(text) => onChange({ ...block, items: text.split("\n") })}
        />
      </div>
    );
  }

  if (block.type === "quote") {
    return (
      <div className="flex flex-col gap-4">
        <BlogLinkTextField
          label={translate("admin.blog.editor.quoteText")}
          value={block.text}
          disabled={disabled}
          maxLength={1000}
          rows={3}
          place={place}
          error={error}
          onValueChange={(text) => onChange({ ...block, text })}
        />
        <FormField
          label={translate("admin.blog.editor.quoteCite")}
          optionalLabel={translate("admin.blog.editor.optional")}
        >
          <Input
            value={block.cite ?? ""}
            disabled={disabled}
            maxLength={120}
            onChange={(event) => onChange({ ...block, cite: event.target.value })}
          />
        </FormField>
      </div>
    );
  }

  const chosen = block.path !== "";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="relative aspect-16/10 w-full shrink-0 overflow-hidden rounded-lg bg-canvas-sunken md:w-56">
          <CardCover src={chosen ? imageUrl(block.path) : undefined} alt="" sizes="224px" />
        </div>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={onChooseImage}
          >
            {chosen
              ? translate("admin.blog.editor.replacePicture")
              : translate("admin.blog.editor.choosePicture")}
          </Button>
          <p className="text-caption text-muted">{translate("admin.blog.editor.pictureRules")}</p>
        </div>
      </div>
      <FormField
        label={translate("admin.blog.editor.imageAlt")}
        hint={translate("admin.blog.editor.imageAltHint")}
        {...problem}
      >
        <Input
          value={block.alt}
          disabled={disabled}
          maxLength={200}
          onChange={(event) => onChange({ ...block, alt: event.target.value })}
        />
      </FormField>
      <FormField
        label={translate("admin.blog.editor.imageCaption")}
        optionalLabel={translate("admin.blog.editor.optional")}
      >
        <Input
          value={block.caption ?? ""}
          disabled={disabled}
          maxLength={200}
          onChange={(event) => onChange({ ...block, caption: event.target.value })}
        />
      </FormField>
    </div>
  );
}

export { BlogBlockEditor, emptyBlock };
