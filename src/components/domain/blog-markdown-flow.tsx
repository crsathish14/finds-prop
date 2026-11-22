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
 *   draft; answers `{ ok: true }` or the problems by box name, already translated), backHref, defaultMarkdown (the paste box's first text), debounceMs (how long the
 *   preview waits after typing; 250 by default), className.
 * Responsive: one column on a phone with no sideways scroll (the paste box, the boxes, the changes, then the preview);
 *   from the large width the paste box and the preview sit side by side.
 * Accessibility: every box has a visible label tied to it; a problem is a message tied to its box with an icon, and
 *   focus goes to the first box with one; the preview is a labelled region that is read politely; the changes and the
 *   problems are lists inside alerts; the create button says it is working while it saves.
 * States: empty (a gentle note, nothing to create), typed (the preview, the changes), with problems (the button is
 *   off and each problem says what to change), saving, a refused save (the problems under the boxes).
 * Dependencies: FormField, Input, Textarea, Select, Alert, Button, Heading, Text, BlogBlocks, BlogArticleHeader,
 *   next-intl.
 * Tests: blog-markdown-flow.test.tsx; Design Lab "Blog" board (ADR-172).
 * UX reference: none yet; drawn for the owner's approval (ADR-172).
 */
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import type { Translator } from "@/i18n/failure-text";
import { cn } from "@/lib/cn";
import { BlogArticleHeader } from "./blog-article-header";
import { BlogBlocks, type BlogBlock } from "./blog-blocks";

/** One change or problem: what happened (a code), where (a line of the pasted text) and what was lost. */
type MarkdownNote = {
  code: string;
  line: number | null;
  detail?: string | undefined;
  count?: number | undefined;
};

/** What the conversion answers; the feature's converter returns this shape. */
type MarkdownPreview = {
  blocks: BlogBlock[];
  title: string;
  slug: string;
  excerpt: string;
  warnings: MarkdownNote[];
  errors: MarkdownNote[];
};

type MarkdownCreateInput = {
  markdown: string;
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
  convert: (markdown: string) => MarkdownPreview;
  onCreate: (input: MarkdownCreateInput) => Promise<MarkdownCreateResult>;
  backHref: string;
  /** The text the paste box starts with (the Design Lab shows a pasted article). */
  defaultMarkdown?: string;
  debounceMs?: number;
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
const BOX_ORDER = ["markdown", "title", "slug", "authorName", "categoryId", "excerpt"] as const;

function BlogMarkdownFlow({
  categories,
  initialCategory = "",
  convert,
  onCreate,
  backHref,
  defaultMarkdown = "",
  debounceMs = 250,
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

  // The preview waits until typing stops, so a big paste is converted once.
  useEffect(() => {
    if (debounceMs <= 0) return;
    const timer = setTimeout(() => setWaited(markdown), debounceMs);
    return () => clearTimeout(timer);
  }, [markdown, debounceMs]);

  const preview = useMemo(() => convert(settled), [convert, settled]);
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
        <Heading as="h1" size="1">
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
          <FormField
            label={translate("admin.blog.markdown.paste.label")}
            hint={translate("admin.blog.markdown.paste.hint")}
            {...problem("markdown")}
          >
            <Textarea
              data-box="markdown"
              rows={14}
              value={markdown}
              disabled={saving}
              spellCheck={false}
              placeholder={translate("admin.blog.markdown.paste.placeholder")}
              className="font-mono"
              onChange={(event) => {
                setMarkdown(event.target.value);
                setErrors({});
              }}
            />
          </FormField>
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
              <li>{translate("admin.blog.markdown.syntax.other")}</li>
            </ul>
          </div>
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
            aria-live="polite"
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
                <BlogBlocks blocks={preview.blocks} imageUrl={() => ""} />
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
  MarkdownCreateInput,
  MarkdownCreateResult,
  MarkdownNote,
  MarkdownPreview,
  BlogMarkdownFlowProps,
};
