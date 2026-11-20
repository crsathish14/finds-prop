"use client";

/**
 * BlogPostForm: the boxes of the Blog editor: the basics, the cover, the body and the search description.
 * Purpose: everything an admin fills in to write an article (ADR-143 section 5), in four titled sections: Basics
 *   (title, address, author, category, tags, summary), Cover picture, Body (the block editor) and Search description (a
 *   title and description for search engines and shares, with a preview of how they read). Owner: design system. It
 *   keeps nothing: the page keeps the values, sends them with the save action and passes back what went wrong.
 * Props: values ({ title, slug, authorName, categoryId, tags, excerpt, seoTitle, seoDescription, blocks, coverAlt }),
 *   onChange (the new values), categories ({ id, name }; the Blog's categories), coverUrl (the cover now, or null),
 *   imageUrl (the address a stored picture path is shown from), onChooseCover, onRemoveCover, onChooseImage (a body
 *   picture, by the block's place), onSuggestSlug (makes the address from the title; the button is left out when not
 *   given), published (the article is on the site: the address box warns that changing it breaks old links), errors
 *   (a message by box name: title, slug, authorName, categoryId, tags, excerpt, seoTitle, seoDescription, coverAlt,
 *   body; already translated), blockErrors (by the block's place), disabled (while saving), className.
 * Responsive: one column; the title and the address, and the author and the category, share a line from 768 px; the
 *   cover picture sits beside its description from 640 px; the preview is a single card at every width.
 * Accessibility: every box has a visible label tied to it; a problem is a message tied to its box with an icon; the cover
 *   needs a description and says why; counters are read politely; each section is a labelled region.
 * States: empty (a new draft), filled, published (the address warning), with problems, cover chosen and not chosen,
 *   disabled while saving.
 * Dependencies: FormSection, FormField, Input, Textarea, Select, TagListField, BlogBlockEditor, Button, CardCover,
 *   next-intl.
 * Tests: blog-admin-parts.test.tsx; Design Lab "Blog post form" (ADR-143).
 * UX reference: none yet; drawn for the owner's approval (the Blog editor, ADR-143 section 5).
 */
import { useTranslations } from "next-intl";
import { FormField } from "@/components/patterns/form-field";
import { FormSection } from "@/components/patterns/form-section";
import { TagListField } from "@/components/patterns/tag-list-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { BlogBlockEditor } from "./blog-block-editor";
import type { BlogBlock } from "./blog-blocks";
import { CardCover } from "./property-card-controls.client";

type BlogPostFormValues = {
  title: string;
  slug: string;
  authorName: string;
  /** The category's id, or "" for none. */
  categoryId: string;
  tags: string[];
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  blocks: BlogBlock[];
  coverAlt: string;
};

type BlogPostFormProps = {
  values: BlogPostFormValues;
  onChange: (values: BlogPostFormValues) => void;
  categories: readonly { id: string; name: string }[];
  coverUrl: string | null;
  imageUrl: (path: string) => string;
  onChooseCover: () => void;
  onRemoveCover: () => void;
  onChooseImage: (index: number) => void;
  onSuggestSlug?: (() => void) | undefined;
  published?: boolean;
  errors?: Readonly<Partial<Record<string, string>>>;
  blockErrors?: Readonly<Record<number, string>>;
  disabled?: boolean;
  className?: string;
};

const TITLE_MAX = 160;
const SLUG_MAX = 120;
const AUTHOR_MAX = 80;
const EXCERPT_MAX = 320;
const SEO_TITLE_MAX = 70;
const SEO_DESCRIPTION_MAX = 170;
const ALT_MAX = 200;
const TAGS_MAX = 10;

function BlogPostForm({
  values,
  onChange,
  categories,
  coverUrl,
  imageUrl,
  onChooseCover,
  onRemoveCover,
  onChooseImage,
  onSuggestSlug,
  published = false,
  errors = {},
  blockErrors = {},
  disabled = false,
  className,
}: BlogPostFormProps) {
  const translate = useTranslations();
  const set = <Key extends keyof BlogPostFormValues>(key: Key, value: BlogPostFormValues[Key]) =>
    onChange({ ...values, [key]: value });
  const problem = (name: string) => {
    const message = errors[name];
    return message ? { error: message } : {};
  };
  const previewTitle = values.seoTitle.trim() || values.title.trim();
  const previewDescription = values.seoDescription.trim() || values.excerpt.trim();

  return (
    <div data-slot="blog-post-form" className={cn("flex min-w-0 flex-col gap-6", className)}>
      <FormSection
        id="blog-basics"
        title={translate("admin.blog.form.basics.title")}
        description={translate("admin.blog.form.basics.description")}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label={translate("admin.blog.form.title")} {...problem("title")}>
            <Input
              value={values.title}
              disabled={disabled}
              maxLength={TITLE_MAX}
              onChange={(event) => set("title", event.target.value)}
            />
          </FormField>
          <div className="flex flex-col gap-2">
            <FormField
              label={translate("admin.blog.form.slug")}
              hint={translate("admin.blog.form.slugHint")}
              {...problem("slug")}
            >
              <Input
                value={values.slug}
                disabled={disabled}
                maxLength={SLUG_MAX}
                autoCapitalize="none"
                spellCheck={false}
                onChange={(event) => set("slug", event.target.value)}
              />
            </FormField>
            {onSuggestSlug ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit"
                disabled={disabled || values.title.trim() === ""}
                onClick={onSuggestSlug}
              >
                {translate("admin.blog.form.slugSuggest")}
              </Button>
            ) : null}
            {published ? (
              <p className="text-caption text-warning">{translate("admin.blog.form.slugLive")}</p>
            ) : null}
          </div>
          <FormField label={translate("admin.blog.form.author")} {...problem("authorName")}>
            <Input
              value={values.authorName}
              disabled={disabled}
              maxLength={AUTHOR_MAX}
              onChange={(event) => set("authorName", event.target.value)}
            />
          </FormField>
          <FormField label={translate("admin.blog.form.category")} {...problem("categoryId")}>
            <Select
              value={values.categoryId}
              disabled={disabled}
              onChange={(event) => set("categoryId", event.target.value)}
            >
              <option value="">{translate("admin.blog.form.noCategory")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <TagListField
          label={translate("admin.blog.form.tags")}
          hint={translate("admin.blog.form.tagsHint")}
          tags={values.tags}
          onChange={(tags) => set("tags", tags)}
          max={TAGS_MAX}
          maxLength={40}
          disabled={disabled}
          {...problem("tags")}
          words={{
            placeholder: translate("admin.blog.form.tagsPlaceholder"),
            add: translate("admin.blog.form.tagsAdd"),
            remove: translate("admin.blog.form.tagsRemove"),
            suggestions: translate("admin.blog.form.tagsSuggestions"),
            full: translate("admin.blog.form.tagsFull", { max: TAGS_MAX }),
          }}
        />
        <FormField
          label={translate("admin.blog.form.excerpt")}
          hint={translate("admin.blog.form.excerptHint")}
          {...problem("excerpt")}
        >
          <Textarea
            value={values.excerpt}
            disabled={disabled}
            maxLength={EXCERPT_MAX}
            rows={3}
            counter={`${values.excerpt.length} / ${EXCERPT_MAX}`}
            onChange={(event) => set("excerpt", event.target.value)}
          />
        </FormField>
      </FormSection>

      <FormSection
        id="blog-cover"
        title={translate("admin.blog.form.cover.title")}
        description={translate("admin.blog.form.cover.description")}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="relative aspect-16/9 w-full shrink-0 overflow-hidden rounded-lg bg-canvas-sunken md:w-64">
            <CardCover src={coverUrl ?? undefined} alt="" sizes="256px" />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled}
                onClick={onChooseCover}
              >
                {coverUrl
                  ? translate("admin.blog.form.cover.replace")
                  : translate("admin.blog.form.cover.choose")}
              </Button>
              {coverUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={onRemoveCover}
                >
                  {translate("admin.blog.form.cover.remove")}
                </Button>
              ) : null}
            </div>
            <p className="text-caption text-muted">{translate("admin.blog.form.cover.rules")}</p>
          </div>
        </div>
        {coverUrl ? (
          <FormField
            label={translate("admin.blog.form.cover.alt")}
            hint={translate("admin.blog.form.cover.altHint")}
            {...problem("coverAlt")}
          >
            <Input
              value={values.coverAlt}
              disabled={disabled}
              maxLength={ALT_MAX}
              onChange={(event) => set("coverAlt", event.target.value)}
            />
          </FormField>
        ) : null}
      </FormSection>

      <FormSection
        id="blog-body"
        title={translate("admin.blog.form.body.title")}
        description={translate("admin.blog.form.body.description")}
      >
        {errors.body ? (
          <p role="alert" className="text-small text-danger">
            {errors.body}
          </p>
        ) : null}
        <BlogBlockEditor
          blocks={values.blocks}
          onChange={(blocks) => set("blocks", blocks)}
          imageUrl={imageUrl}
          onChooseImage={onChooseImage}
          errors={blockErrors}
          disabled={disabled}
        />
      </FormSection>

      <FormSection
        id="blog-seo"
        title={translate("admin.blog.form.seo.title")}
        description={translate("admin.blog.form.seo.description")}
      >
        <FormField
          label={translate("admin.blog.form.seo.seoTitle")}
          optionalLabel={translate("admin.blog.editor.optional")}
          hint={translate("admin.blog.form.seo.seoTitleHint")}
          {...problem("seoTitle")}
        >
          <Input
            value={values.seoTitle}
            disabled={disabled}
            maxLength={SEO_TITLE_MAX}
            onChange={(event) => set("seoTitle", event.target.value)}
          />
        </FormField>
        <FormField
          label={translate("admin.blog.form.seo.seoDescription")}
          optionalLabel={translate("admin.blog.editor.optional")}
          hint={translate("admin.blog.form.seo.seoDescriptionHint")}
          {...problem("seoDescription")}
        >
          <Textarea
            value={values.seoDescription}
            disabled={disabled}
            maxLength={SEO_DESCRIPTION_MAX}
            rows={3}
            counter={`${values.seoDescription.length} / ${SEO_DESCRIPTION_MAX}`}
            onChange={(event) => set("seoDescription", event.target.value)}
          />
        </FormField>
        <div
          data-slot="blog-seo-preview"
          className="flex min-w-0 flex-col gap-1 rounded-lg border border-line bg-canvas-sunken p-4"
        >
          <p className="text-overline text-muted">{translate("admin.blog.form.seo.preview")}</p>
          <p className="text-title-sm font-semibold text-primary [overflow-wrap:anywhere]">
            {previewTitle || translate("admin.blog.form.seo.previewEmptyTitle")}
          </p>
          <p className="text-caption text-success [overflow-wrap:anywhere]">
            {translate("admin.blog.form.seo.previewAddress", { slug: values.slug || "…" })}
          </p>
          <p className="text-small text-muted [overflow-wrap:anywhere]">
            {previewDescription || translate("admin.blog.form.seo.previewEmptyDescription")}
          </p>
        </div>
      </FormSection>
    </div>
  );
}

export { BlogPostForm };
export type { BlogPostFormValues };
