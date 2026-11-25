"use client";

/**
 * BlogMarkdownFlow: paste an article written elsewhere as Markdown, see it drawn as readers will, and make a draft (ADR-172).
 * Purpose: a second way to start a Blog article, beside the block editor. A big paste box (with the supported syntax
 *   listed beside it), the article's title, address, summary, author and category (the title, address and summary are
 *   filled from the text until the admin types their own), a live preview drawn by the same `BlogBlocks` readers see, and
 *   a list of every change the conversion made. "Create draft" asks the page to make the draft; the page opens it in the
 *   block editor. The pasted text is never stored. Part of the Markdown flow's files, so it goes with them.
 *   Owner: design system. It keeps the typed text and the boxes; the conversion and the saving are the page's (props).
 * Props: categories ({ id, name }), initialCategory, convert (text in, a preview out: the blocks, the title, the
 *   address, the summary, the changes and the problems; must be a stable function), onCreate (asks the page to make the
 *   draft; answers `{ ok: true }` or the problems by box name, already translated), backHref, defaultMarkdown (the paste box's first text), headingAs (h1 by default), debounceMs (how long the
 *   preview waits after typing; 250 by default), className. ADR-173: aiPrompt (the text a writer gives an AI tool to
 *   get Markdown this screen reads; a "Copy the AI prompt" button copies it) and pictureRules (what a picture file may
 *   be: the chooser's accept list, a check of one file, the ending it is stored with, the weight limit shown to the
 *   admin). The paste box has an "Add link" form (the block editor's), and each `![what it shows](IMAGE-1)` line of
 *   the text is a place for a picture with its own file chooser and description; the chosen files wait in the
 *   browser, are drawn in the preview at their place, and are sent by the page when the draft is made.
 * Responsive: one column on a phone with no sideways scroll (the paste box, the boxes, the changes, then the preview);
 *   from the large width the paste box and the preview sit side by side.
 * Accessibility: every box has a visible label tied to it; a problem is a message tied to its box with an icon, and
 *   focus goes to the first box with one; the preview is a labelled region and a short hidden status line says how many blocks, changes and problems there are; the changes and the
 *   problems are lists inside alerts; the create button says it is working while it saves.
 * States: empty (a gentle note, nothing to create), typed (the preview, the changes), with problems (the button is
 *   off and each problem says what to change), saving, a refused save (the problems under the boxes).
 * Dependencies: FormField, Input, Textarea, Select, Alert, Button, Heading, Text, BlogBlocks, BlogArticleHeader,
 *   next-intl.
 * Tests: blog-markdown-flow.test.tsx; Design Lab "Blog" board (ADR-172).
 * UX reference: none yet; drawn for the owner's approval (ADR-172).
 */
import { ArrowLeft, Copy, ImagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { Textarea } from "@/components/ui/textarea";
import type { Translator } from "@/i18n/failure-text";
import { cn } from "@/lib/cn";
import { useImageReduce } from "@/lib/use-image-reduce";
import { BlogArticleHeader } from "./blog-article-header";
import { BlogBlocks, type BlogBlock } from "./blog-blocks";
import { BlogLinkTextField } from "./blog-link-text-field";
import { ImageReduceFlow } from "./image-reduce-flow";

/** A copy of a record without one key. */
const without = <Value,>(record: Record<string, Value>, key: string): Record<string, Value> =>
  Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));

/** A picture chosen for a place: the file, how it will be stored, what it shows, and where the browser shows it from. */
type ChosenPicture = { file: File; extension: string; alt: string; url: string };

/** One change or problem: what happened (a code), where (a line of the pasted text) and what was lost. */
type MarkdownNote = {
  code: string;
  line: number | null;
  detail?: string | undefined;
  count?: number | undefined;
};

/** A place for a picture in the pasted text (`IMAGE-1`). */
type MarkdownSlot = {
  id: string;
  /** What the pasted text said the picture shows (may be empty). */
  alt: string;
  line: number;
  /** Set when the pasted line pointed at an address; that address is never fetched. */
  address?: string | undefined;
};

/** What the conversion answers; the feature's converter returns this shape. */
type MarkdownPreview = {
  blocks: BlogBlock[];
  slots: MarkdownSlot[];
  title: string;
  slug: string;
  excerpt: string;
  warnings: MarkdownNote[];
  errors: MarkdownNote[];
};

/** A picture the admin chose for a place; its file waits in the browser until the page sends it. */
type MarkdownChosenPicture = { slot: string; file: File; extension: string; alt: string };

/**
 * What a picture file may be; the feature knows the rules, the screen only asks. A picture is cleaned of its hidden data
 * first; one still over `limitBytes` is not refused: the admin is asked whether to lower its quality to fit.
 */
type MarkdownPictureRules = {
  /** The file chooser's `accept` list. */
  accept: string;
  /** The most a picture may weigh, in bytes. */
  limitBytes: number;
  /** The ending the file is stored with, or null when it is not a kind the bucket takes. */
  extension: (file: File) => string | null;
  /** The weight limit, in KB, said in the words. */
  maximumKb: number;
};

type MarkdownCreateInput = {
  markdown: string;
  pictures: MarkdownChosenPicture[];
  title: string;
  slug: string;
  excerpt: string;
  authorName: string;
  /** The category's id, or null for none. */
  categoryId: string | null;
};

type MarkdownCreateResult =
  { ok: true } | { ok: false; errors: Partial<Record<string, string>>; message?: string };

type BlogMarkdownFlowProps = {
  categories: readonly { id: string; name: string }[];
  initialCategory?: string;
  /** `pictures` are the chosen ones by place name; a chosen one is drawn at its place (its `path` is any name `imageUrl` knows). */
  convert: (
    markdown: string,
    pictures?: Readonly<Record<string, { path: string; alt: string }>>,
  ) => MarkdownPreview;
  /** The prompt to give an AI tool (ADR-173). */
  aiPrompt: string;
  pictureRules: MarkdownPictureRules;
  onCreate: (input: MarkdownCreateInput) => Promise<MarkdownCreateResult>;
  backHref: string;
  /** The text the paste box starts with (the Design Lab shows a pasted article). */
  defaultMarkdown?: string;
  debounceMs?: number;
  /** The screen's title is the page's `h1`; a page that already has one (the Design Lab) says `h2`. */
  headingAs?: "h1" | "h2";
  className?: string;
};

const TITLE_MAX = 160;
const SLUG_MAX = 120;
const AUTHOR_MAX = 80;
const EXCERPT_MAX = 320;

/** The words of each change and problem (static keys, so the messages check can see them). */
const WARNING_WORDS = {
  titleLater: "admin.blog.markdown.warning.titleLater",
  headingDeep: "admin.blog.markdown.warning.headingDeep",
  headingLink: "admin.blog.markdown.warning.headingLink",
  nestedList: "admin.blog.markdown.warning.nestedList",
  formatting: "admin.blog.markdown.warning.formatting",
  linkDropped: "admin.blog.markdown.warning.linkDropped",
  codeBlock: "admin.blog.markdown.warning.codeBlock",
  table: "admin.blog.markdown.warning.table",
  image: "admin.blog.markdown.warning.image",
  html: "admin.blog.markdown.warning.html",
  split: "admin.blog.markdown.warning.split",
  rule: "admin.blog.markdown.warning.rule",
  imageFromAddress: "admin.blog.markdown.warning.imageFromAddress",
  imageSlotEmpty: "admin.blog.markdown.warning.imageSlotEmpty",
  imageSlotRepeated: "admin.blog.markdown.warning.imageSlotRepeated",
} as const;
const SPLIT_WORDS = {
  paragraph: "admin.blog.markdown.warning.splitParagraph",
  quote: "admin.blog.markdown.warning.splitQuote",
  item: "admin.blog.markdown.warning.splitItem",
  list: "admin.blog.markdown.warning.splitList",
} as const;
const ERROR_WORDS = {
  headingTooLong: "admin.blog.markdown.error.headingTooLong",
  tooManyBlocks: "admin.blog.markdown.error.tooManyBlocks",
  tooBig: "admin.blog.markdown.error.tooBig",
  inputTooBig: "admin.blog.markdown.error.inputTooBig",
} as const;

/** The first box that has a problem, by its place in the form. */
const BOX_ORDER = [
  "markdown",
  "pictures",
  "title",
  "slug",
  "authorName",
  "categoryId",
  "excerpt",
] as const;

/** What the preview calls a chosen picture's place; the file itself is shown from the browser's address of it. */
const SLOT_PATH = "slot/";

function BlogMarkdownFlow({
  categories,
  initialCategory = "",
  convert,
  aiPrompt,
  pictureRules,
  onCreate,
  backHref,
  defaultMarkdown = "",
  debounceMs = 250,
  headingAs = "h1",
  className,
}: BlogMarkdownFlowProps) {
  const translate = useTranslations();
  const everything = useTranslations() as unknown as Translator;
  const formRef = useRef<HTMLFormElement>(null);
  const [markdown, setMarkdown] = useState(defaultMarkdown);
  const [waited, setWaited] = useState(defaultMarkdown);
  // With no wait the preview follows every key; otherwise it follows the text as it was when typing stopped.
  const settled = debounceMs <= 0 ? markdown : waited;
  const [typed, setTyped] = useState<{ title?: string; slug?: string; excerpt?: string }>({});
  const [authorName, setAuthorName] = useState("");
  const [categoryId, setCategoryId] = useState(initialCategory);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<"no" | "yes" | "failed">("no");
  const [chosen, setChosen] = useState<Record<string, ChosenPicture>>({});
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>({});
  const fileId = useId();
  const aiTitleId = useId();
  const choosing = useRef<string | null>(null);
  // A picture over the limit is not refused: the admin may lower its quality to fit. One place is decided at a time.
  const reducer = useImageReduce({ limitBytes: pictureRules.limitBytes });
  const [deciding, setDeciding] = useState<string | null>(null);
  // The browser's addresses of the chosen files, noted when they are made (never during a render) and given back on leaving.
  const addresses = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const address of addresses.current) URL.revokeObjectURL(address);
    },
    [],
  );

  // The preview waits until typing stops, so a big paste is converted once.
  useEffect(() => {
    if (debounceMs <= 0) return;
    const timer = setTimeout(() => setWaited(markdown), debounceMs);
    return () => clearTimeout(timer);
  }, [markdown, debounceMs]);

  const placed = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(chosen).map(([id, picture]) => [
          id,
          { path: `${SLOT_PATH}${id}`, alt: picture.alt },
        ]),
      ),
    [chosen],
  );
  const preview = useMemo(() => convert(settled, placed), [convert, settled, placed]);
  const title = typed.title ?? preview.title;
  const slug = typed.slug ?? preview.slug;
  const excerpt = typed.excerpt ?? preview.excerpt;
  const empty = settled.trim() === "";
  const blocked = preview.errors.length > 0 || preview.blocks.length === 0;
  const waiting = settled !== markdown;
  const category = categories.find((one) => one.id === categoryId);

  // After a refused save or a missing box, focus goes to the first box that has a problem.
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    for (const box of BOX_ORDER) {
      if (!errors[box]) continue;
      formRef.current?.querySelector<HTMLElement>(`[data-box="${box}"]`)?.focus();
      return;
    }
  }, [errors]);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(aiPrompt);
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
  };

  const choose = (id: string) => {
    choosing.current = id;
    document.getElementById(fileId)?.click();
  };

  /** Keeps a picture that is clean and within the limit for a place. */
  const accept = (file: File, id: string) => {
    const extension = pictureRules.extension(file);
    if (extension === null) {
      setSlotErrors((now) => ({ ...now, [id]: translate("validation.blogImageType") }));
      return;
    }
    const url = URL.createObjectURL(file);
    addresses.current.push(url);
    const alt = chosen[id]?.alt ?? preview.slots.find((slot) => slot.id === id)?.alt ?? "";
    setChosen((now) => ({ ...now, [id]: { file, extension, alt, url } }));
    setSlotErrors((now) => without(now, id));
    setErrors({});
  };

  const picked = async (file: File | undefined) => {
    const id = choosing.current;
    choosing.current = null;
    if (!file || !id) return;
    setDeciding(id);
    setSlotErrors((now) => without(now, id));
    const refused = await reducer.choose(file, (ready) => {
      setDeciding(null);
      accept(ready, id);
    });
    if (refused !== null) {
      setDeciding(null);
      setSlotErrors((now) => ({ ...now, [id]: translate("validation.blogImageType") }));
    }
  };

  const warningText = (note: MarkdownNote): string => {
    const split =
      note.code === "split" && note.detail
        ? SPLIT_WORDS[note.detail as keyof typeof SPLIT_WORDS]
        : undefined;
    const key = split ?? WARNING_WORDS[note.code as keyof typeof WARNING_WORDS];
    return key
      ? everything(key, {
          line: note.line ?? 0,
          count: note.count ?? 0,
          detail: note.detail ?? "",
        })
      : note.code;
  };

  const errorText = (note: MarkdownNote): string => {
    const key = ERROR_WORDS[note.code as keyof typeof ERROR_WORDS];
    return key
      ? everything(key, {
          line: note.line ?? 0,
          count: note.count ?? 0,
          maximum: TITLE_MAX,
        })
      : note.code;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const problems: Partial<Record<string, string>> = {};
    if (blocked) problems["markdown"] = translate("admin.blog.markdown.needText");
    const sending = preview.slots.flatMap((slot) => {
      const picture = chosen[slot.id];
      return picture ? [{ slot: slot.id, picture }] : [];
    });
    const missing: Record<string, string> = {};
    for (const { slot, picture } of sending)
      if (picture.alt.trim() === "") missing[slot] = translate("validation.required");
    if (Object.keys(missing).length > 0) {
      setSlotErrors(missing);
      problems["pictures"] = translate("admin.blog.markdown.pictures.needAlt");
    }
    if (title.trim().length < 3) problems["title"] = translate("validation.required");
    if (authorName.trim().length < 2) problems["authorName"] = translate("validation.required");
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const result = await onCreate({
        markdown,
        pictures: sending.map(({ slot, picture }) => ({
          slot,
          file: picture.file,
          extension: picture.extension,
          alt: picture.alt.trim(),
        })),
        title,
        slug: slug.trim(),
        excerpt,
        authorName,
        categoryId: categoryId === "" ? null : categoryId,
      });
      if (!result.ok) setErrors(result.errors);
    } finally {
      setSaving(false);
    }
  };

  const problem = (name: string) => {
    const message = errors[name];
    return message ? { error: message } : {};
  };

  return (
    <div data-slot="blog-markdown-flow" className={cn("flex min-w-0 flex-col gap-6", className)}>
      <div className="flex flex-col gap-2">
        <Link href={backHref} variant="nav" className="inline-flex items-center gap-2 text-small">
          <Icon icon={ArrowLeft} size="sm" />
          {translate("admin.blog.markdown.back")}
        </Link>
        <Heading as={headingAs} size="1">
          {translate("admin.blog.markdown.title")}
        </Heading>
        <Text tone="muted" className="max-w-[70ch]">
          {translate("admin.blog.markdown.intro")}
        </Text>
      </div>
      <form
        ref={formRef}
        noValidate
        onSubmit={(event) => void submit(event)}
        className="grid min-w-0 gap-6 lg:grid-cols-2"
      >
        <div className="flex min-w-0 flex-col gap-4">
          <section
            aria-labelledby={aiTitleId}
            className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
          >
            <Text id={aiTitleId} variant="small" className="font-bold">
              {translate("admin.blog.markdown.ai.title")}
            </Text>
            <Text variant="small" tone="muted">
              {translate("admin.blog.markdown.ai.intro")}
            </Text>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                iconStart={<Icon icon={Copy} />}
                onClick={() => void copyPrompt()}
              >
                {translate("admin.blog.markdown.ai.copy")}
              </Button>
              <span role="status" className="text-small text-muted">
                {copied === "yes"
                  ? translate("admin.blog.markdown.ai.copied")
                  : copied === "failed"
                    ? translate("admin.blog.markdown.ai.copyFailed")
                    : ""}
              </span>
            </div>
            <details className="text-small">
              <summary className="cursor-pointer font-medium text-ink">
                {translate("admin.blog.markdown.ai.show")}
              </summary>
              <pre
                tabIndex={0}
                aria-label={translate("admin.blog.markdown.ai.promptLabel")}
                className="mt-2 max-h-72 overflow-auto rounded-lg border border-line bg-canvas-sunken p-3 text-caption whitespace-pre-wrap text-muted"
              >
                {aiPrompt}
              </pre>
            </details>
          </section>
          <BlogLinkTextField
            label={translate("admin.blog.markdown.paste.label")}
            hint={translate("admin.blog.markdown.paste.hint")}
            value={markdown}
            onValueChange={(next) => {
              setMarkdown(next);
              setErrors({});
            }}
            {...(errors["markdown"] ? { error: errors["markdown"] } : {})}
            place={1}
            rows={14}
            disabled={saving}
            spellCheck={false}
            monospace
            dataBox="markdown"
            placeholder={translate("admin.blog.markdown.paste.placeholder")}
            addLabel={translate("admin.blog.markdown.paste.addLink")}
            groupLabel={translate("admin.blog.markdown.paste.linkGroup")}
          />
          <div className="rounded-xl border border-line bg-surface p-4">
            <Text variant="small" className="font-bold">
              {translate("admin.blog.markdown.syntax.title")}
            </Text>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-small text-muted">
              <li>{translate("admin.blog.markdown.syntax.title1")}</li>
              <li>{translate("admin.blog.markdown.syntax.headings")}</li>
              <li>{translate("admin.blog.markdown.syntax.lists")}</li>
              <li>{translate("admin.blog.markdown.syntax.quotes")}</li>
              <li>{translate("admin.blog.markdown.syntax.links")}</li>
              <li>{translate("admin.blog.markdown.syntax.pictures")}</li>
              <li>{translate("admin.blog.markdown.syntax.other")}</li>
            </ul>
          </div>
          {preview.slots.length > 0 ? (
            <section
              data-box="pictures"
              tabIndex={-1}
              aria-label={translate("admin.blog.markdown.pictures.title", {
                count: preview.slots.length,
              })}
              className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4"
            >
              <Text variant="small" className="font-bold">
                {translate("admin.blog.markdown.pictures.title", { count: preview.slots.length })}
              </Text>
              <Text variant="small" tone="muted">
                {translate("admin.blog.markdown.pictures.intro", {
                  maximum: pictureRules.maximumKb,
                })}
              </Text>
              {errors["pictures"] ? <Alert tone="danger">{errors["pictures"]}</Alert> : null}
              <input
                id={fileId}
                type="file"
                accept={pictureRules.accept}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  void picked(file);
                }}
              />
              <ul className="flex flex-col gap-4">
                {preview.slots.map((slot) => {
                  const picture = chosen[slot.id];
                  const failure = slotErrors[slot.id];
                  return (
                    <li
                      key={slot.id}
                      className="flex min-w-0 flex-col gap-2 border-t border-line pt-4 first:border-t-0 first:pt-0"
                    >
                      <Text variant="small" className="font-medium">
                        {translate("admin.blog.markdown.pictures.place", {
                          id: slot.id,
                          line: slot.line,
                        })}
                      </Text>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          iconStart={<Icon icon={ImagePlus} />}
                          disabled={saving}
                          onClick={() => choose(slot.id)}
                        >
                          {translate(
                            picture
                              ? "admin.blog.markdown.pictures.change"
                              : "admin.blog.markdown.pictures.choose",
                            { id: slot.id },
                          )}
                        </Button>
                        {picture ? (
                          <>
                            <Text variant="small" tone="muted" className="min-w-0 break-all">
                              {translate("admin.blog.markdown.pictures.chosen", {
                                name: picture.file.name,
                                kb: Math.max(1, Math.round(picture.file.size / 1024)),
                              })}
                            </Text>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={saving}
                              onClick={() => setChosen((now) => without(now, slot.id))}
                            >
                              {translate("admin.blog.markdown.pictures.remove", { id: slot.id })}
                            </Button>
                          </>
                        ) : (
                          <Text variant="small" tone="muted">
                            {translate("admin.blog.markdown.pictures.none")}
                          </Text>
                        )}
                      </div>
                      {picture ? (
                        <FormField
                          label={translate("admin.blog.markdown.pictures.alt", { id: slot.id })}
                          hint={translate("admin.blog.markdown.pictures.altHint")}
                          {...(failure ? { error: failure } : {})}
                        >
                          <Input
                            value={picture.alt}
                            disabled={saving}
                            maxLength={200}
                            onChange={(event) => {
                              const alt = event.target.value;
                              setChosen((now) =>
                                now[slot.id] ? { ...now, [slot.id]: { ...picture, alt } } : now,
                              );
                              setSlotErrors((now) => without(now, slot.id));
                            }}
                          />
                        </FormField>
                      ) : failure ? (
                        <Text variant="small" role="alert" className="text-danger">
                          {failure}
                        </Text>
                      ) : null}
                      {deciding === slot.id ? (
                        <ImageReduceFlow
                          prompt={reducer.prompt}
                          onReduce={() => void reducer.reduce()}
                          onUse={reducer.use}
                          onChooseAnother={() => {
                            reducer.dismiss();
                            setDeciding(null);
                            choose(slot.id);
                          }}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label={translate("admin.blog.form.title")} {...problem("title")}>
              <Input
                data-box="title"
                value={title}
                disabled={saving}
                maxLength={TITLE_MAX}
                onChange={(event) => {
                  setTyped((now) => ({ ...now, title: event.target.value }));
                  setErrors({});
                }}
              />
            </FormField>
            <FormField
              label={translate("admin.blog.form.slug")}
              hint={translate("admin.blog.form.slugHint")}
              {...problem("slug")}
            >
              <Input
                data-box="slug"
                value={slug}
                disabled={saving}
                maxLength={SLUG_MAX}
                autoCapitalize="none"
                spellCheck={false}
                onChange={(event) => {
                  setTyped((now) => ({ ...now, slug: event.target.value }));
                  setErrors({});
                }}
              />
            </FormField>
            <FormField label={translate("admin.blog.form.author")} {...problem("authorName")}>
              <Input
                data-box="authorName"
                value={authorName}
                disabled={saving}
                maxLength={AUTHOR_MAX}
                onChange={(event) => {
                  setAuthorName(event.target.value);
                  setErrors({});
                }}
              />
            </FormField>
            <FormField label={translate("admin.blog.form.category")} {...problem("categoryId")}>
              <Select
                data-box="categoryId"
                value={categoryId}
                disabled={saving}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setErrors({});
                }}
              >
                <option value="">{translate("admin.blog.form.noCategory")}</option>
                {categories.map((one) => (
                  <option key={one.id} value={one.id}>
                    {one.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField label={translate("admin.blog.form.excerpt")} {...problem("excerpt")}>
            <Textarea
              data-box="excerpt"
              rows={3}
              value={excerpt}
              disabled={saving}
              maxLength={EXCERPT_MAX}
              onChange={(event) => {
                setTyped((now) => ({ ...now, excerpt: event.target.value }));
                setErrors({});
              }}
            />
          </FormField>
          {errors["_form"] ? <Alert tone="danger">{errors["_form"]}</Alert> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={saving || (!empty && blocked)}>
              {translate(saving ? "admin.blog.markdown.creating" : "admin.blog.markdown.create")}
            </Button>
            <Button asChild variant="ghost">
              <Link href={backHref} variant="nav" className="no-underline">
                {translate("admin.blog.form.cancel")}
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <VisuallyHidden>
            <span role="status">
              {empty
                ? ""
                : translate("admin.blog.markdown.preview.status", {
                    blocks: preview.blocks.length,
                    changes: preview.warnings.length,
                    problems: preview.errors.length,
                  })}
            </span>
          </VisuallyHidden>
          {preview.errors.length > 0 ? (
            <Alert tone="danger" title={translate("admin.blog.markdown.errors.title")}>
              <ul className="list-disc space-y-1 pl-5">
                {preview.errors.map((note, place) => (
                  <li key={`${note.code}-${place}`}>{errorText(note)}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
          {preview.warnings.length > 0 ? (
            <Alert
              tone="warning"
              title={translate("admin.blog.markdown.warnings.title", {
                count: preview.warnings.length,
              })}
            >
              <ul className="list-disc space-y-1 pl-5">
                {preview.warnings.map((note, place) => (
                  <li key={`${note.code}-${place}`}>{warningText(note)}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
          <section
            aria-label={translate("admin.blog.markdown.preview.label")}
            aria-busy={waiting}
            data-slot="blog-markdown-preview"
            className="flex min-w-0 flex-col gap-6 rounded-xl border border-line bg-surface p-6"
          >
            <Text variant="small" tone="muted">
              {translate("admin.blog.markdown.preview.note")}
            </Text>
            {empty ? (
              <Text tone="muted">{translate("admin.blog.markdown.preview.empty")}</Text>
            ) : (
              <>
                <BlogArticleHeader
                  headingLevel="h2"
                  title={title.trim() || translate("admin.blog.preview.untitled")}
                  excerpt={excerpt.trim() || undefined}
                  category={category ? { name: category.name, href: "#" } : null}
                  authorName={authorName.trim() || "…"}
                  publishedAt={null}
                  cover={null}
                />
                <BlogBlocks
                  blocks={preview.blocks}
                  imageUrl={(path) => chosen[path.slice(SLOT_PATH.length)]?.url ?? ""}
                />
              </>
            )}
          </section>
        </div>
      </form>
    </div>
  );
}

export { BlogMarkdownFlow };
export type {
  MarkdownChosenPicture,
  MarkdownPictureRules,
  MarkdownSlot,
  MarkdownCreateInput,
  MarkdownCreateResult,
  MarkdownNote,
  MarkdownPreview,
  BlogMarkdownFlowProps,
};
