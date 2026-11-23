"use client";

import { ArrowLeft, Eye, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { BlogArticleHeader } from "@/components/domain/blog-article-header";
import { BlogBlocks, type BlogBlock } from "@/components/domain/blog-blocks";
import { BlogPostForm, type BlogPostFormValues } from "@/components/domain/blog-post-form";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { notify } from "@/lib/notify";
import { publicEnv } from "@/lib/public-env";
import { publicStorageUrl } from "@/lib/storage-url";
import {
  extensionOf,
  newPendingPath,
  PICTURE_ACCEPT,
  pictureProblem,
  randomToken,
} from "./blog-pictures";
import {
  saveArticle,
  type BlogEditorActions,
  type PendingPictures,
  type SaveResult,
} from "./blog-save";
import { createBlogStorage, type BlogStorage } from "./blog-storage";
import { BLOG_IMAGE_BUCKET, BLOG_IMAGE_MAX_KB } from "./constants";
import { ADMIN_BLOG_PATH, adminBlogEditPath } from "./page-params";
import { slugFromTitle } from "./slug";
import type { AdminBlogPostView } from "./view";

export type { BlogEditorActions } from "./blog-save";

type BlogEditorProps = {
  /** The article being edited, or null for a new one. */
  post: AdminBlogPostView | null;
  /** The Blog's categories to choose from (hidden ones are offered too, marked as hidden by the page). */
  categories: { id: string; name: string; slug: string }[];
  /** The category to start a new article in, when the list was narrowed to one. */
  initialCategory?: string;
  actions: BlogEditorActions;
  /** Where pictures are sent; the real bucket unless a test gives its own. */
  storage?: BlogStorage;
};

/** The boxes of the form that a failure can name; anything else goes to a toast. */
const BOXES = [
  "title",
  "slug",
  "authorName",
  "categoryId",
  "tags",
  "excerpt",
  "seoTitle",
  "seoDescription",
  "coverAlt",
  "body",
] as const;

function boxOf(field: string): string | null {
  if (field === "coverPath") return "coverAlt";
  const [head = "", rest] = field.split(".");
  if (head === "body" && rest !== undefined) return null;
  return (BOXES as readonly string[]).includes(head) ? head : null;
}

/** The place of the block a "body.2.text" style field names, or null. */
function blockPlaceOf(field: string): number | null {
  const [head, place] = field.split(".");
  if (head !== "body" || place === undefined) return null;
  const number = Number(place);
  return Number.isInteger(number) ? number : null;
}

const storedUrl = (path: string): string =>
  publicStorageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, BLOG_IMAGE_BUCKET, path);

/**
 * The admin's article page (ADR-143, ADR-144, FR-ADM-13): the form (Basics, Cover, Body as blocks, Search description)
 * above the save bar the project form uses, for a new article or one being edited, and a preview that draws the article
 * as visitors will see it. A picture the admin chooses waits in the browser (its own preview address) and is sent to the
 * bucket when the article is saved; `saveArticle` makes a new article first, sends the pictures, saves the body and then
 * sets the cover, and takes back the files it sent when a step fails. The values stay typed when a save fails, each
 * problem sits on its box or block, and a failure with no box to blame is a toast. A saved existing article stays on
 * this page, read again; a new one opens at its own address. Status changes (publish, unpublish, archive) are on the list.
 */
export function BlogEditor({
  post,
  categories,
  initialCategory = "",
  actions,
  storage,
}: BlogEditorProps) {
  const translate = useTranslations("admin.blog");
  const everything = useTranslations() as unknown as Translator;
  const router = useRouter();
  const fileId = useId();

  const [postId, setPostId] = useState<string | null>(post?.id ?? null);
  const [values, setValues] = useState<BlogPostFormValues>({
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    authorName: post?.authorName ?? "",
    categoryId: post?.categoryId ?? initialCategory,
    tags: post?.tags ?? [],
    excerpt: post?.excerpt ?? "",
    seoTitle: post?.seoTitle ?? "",
    seoDescription: post?.seoDescription ?? "",
    blocks: (post?.body ?? []) as BlogBlock[],
    coverAlt: post?.coverAlt ?? "",
  });
  const [coverPath, setCoverPath] = useState<string | null>(post?.coverPath ?? null);
  const [pending, setPending] = useState<PendingPictures>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [blockErrors, setBlockErrors] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const bucket = useRef<BlogStorage | null>(storage ?? null);
  const target = useRef<{ kind: "cover" } | { kind: "image"; index: number } | null>(null);
  // The browser's addresses of the chosen pictures, noted when they are made (never during a render).
  const addresses = useRef<string[]>([]);

  // The browser's addresses of the chosen pictures are given back when the page is left.
  useEffect(
    () => () => {
      for (const address of addresses.current) URL.revokeObjectURL(address);
    },
    [],
  );

  const imageUrl = (path: string): string => pending[path]?.url ?? storedUrl(path);
  const coverUrl =
    coverPath === null
      ? null
      : (pending[coverPath]?.url ??
        (coverPath === post?.coverPath && post.coverUrl ? post.coverUrl : storedUrl(coverPath)));

  const change = (next: BlogPostFormValues) => {
    setValues(next);
    setErrors({});
    setBlockErrors({});
  };

  const choose = (place: { kind: "cover" } | { kind: "image"; index: number }) => {
    target.current = place;
    document.getElementById(fileId)?.click();
  };

  const picked = (file: File | undefined) => {
    const place = target.current;
    target.current = null;
    if (!file || !place) return;
    const problem = pictureProblem(file);
    if (problem !== null) {
      notify.error(
        problem === "type"
          ? everything("validation.blogImageType")
          : everything("validation.blogImageSize", { maximum: BLOG_IMAGE_MAX_KB }),
      );
      return;
    }
    const extension = extensionOf(file) as string;
    const path = newPendingPath(randomToken(), extension);
    const url = URL.createObjectURL(file);
    addresses.current.push(url);
    setPending((current) => ({ ...current, [path]: { file, url, extension } }));
    if (place.kind === "cover") {
      setCoverPath(path);
    } else {
      setValues((current) => ({
        ...current,
        blocks: current.blocks.map((block, index) =>
          index === place.index && block.type === "image" ? { ...block, path } : block,
        ),
      }));
    }
    setErrors({});
    setBlockErrors({});
  };

  const showFailure = (result: Extract<SaveResult, { ok: false }>) => {
    const fieldErrors = result.fieldErrors ?? result.failure?.fieldErrors ?? {};
    const boxes: Record<string, string> = {};
    const blocks: Record<number, string> = {};
    for (const [field, problems] of Object.entries(fieldErrors)) {
      const first = problems[0];
      if (!first) continue;
      const text = fieldErrorText(everything, first);
      const place = blockPlaceOf(field);
      if (place !== null) blocks[place] ??= text;
      else {
        const box = boxOf(field);
        if (box) boxes[box] ??= text;
      }
    }
    setErrors(boxes);
    setBlockErrors(blocks);
    if (Object.keys(boxes).length > 0 || Object.keys(blocks).length > 0) return;
    if (result.step === "upload") return notify.error(translate("uploadFailed"));
    const failure = result.failure;
    notify.error(
      failure?.code === "NOT_FOUND"
        ? translate("gone")
        : failure
          ? failureText(everything, failure)
          : translate("uploadFailed"),
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      bucket.current ??= createBlogStorage();
      const result = await saveArticle({
        postId,
        values,
        coverPath,
        stored: { coverPath: post?.coverPath ?? null, coverAlt: post?.coverAlt ?? null },
        pending,
        storage: bucket.current,
        actions,
      });
      if (result.ok) {
        notify.success(translate(result.created ? "toast.created" : "toast.saved"));
        if (result.created) router.replace(adminBlogEditPath(result.postId));
        router.refresh();
        return;
      }
      // The article exists once it has been made, even when a later step failed: the next save updates it.
      if (result.postId !== null && postId === null) {
        setPostId(result.postId);
        if (values.slug.trim() === "" && result.slug)
          setValues((current) => ({ ...current, slug: result.slug as string }));
      }
      showFailure(result);
      if (result.step === "cover") router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const heading = translate(post ? "editTitle" : "newTitle");
  const category = categories.find((one) => one.id === values.categoryId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={ADMIN_BLOG_PATH}
          variant="nav"
          className="inline-flex items-center gap-2 text-small"
        >
          <Icon icon={ArrowLeft} size="sm" />
          {translate("back")}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Heading as="h1" size="1">
            {heading}
          </Heading>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPreviewing((now) => !now)}
            aria-pressed={previewing}
          >
            <Icon icon={previewing ? Pencil : Eye} />
            {translate(previewing ? "preview.hide" : "preview.show")}
          </Button>
        </div>
      </div>
      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex max-w-4xl flex-col gap-6"
      >
        {/* The chooser is kept in the page while the preview shows, so a chosen file is not lost. */}
        <Input
          id={fileId}
          type="file"
          accept={PICTURE_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            picked(file);
          }}
        />
        {previewing ? (
          <div
            data-slot="blog-editor-preview"
            className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-6"
          >
            <p className="text-small text-muted">{translate("preview.note")}</p>
            {values.title.trim() === "" && values.blocks.length === 0 ? (
              <p className="text-body text-muted">{translate("preview.empty")}</p>
            ) : (
              <>
                <BlogArticleHeader
                  headingLevel="h2"
                  title={values.title.trim() || translate("preview.untitled")}
                  excerpt={values.excerpt.trim() || undefined}
                  category={category ? { name: category.name, href: "#" } : null}
                  authorName={values.authorName.trim() || "…"}
                  publishedAt={post?.publishedAt ?? null}
                  cover={
                    coverUrl ? { src: coverUrl, alt: values.coverAlt.trim() || values.title } : null
                  }
                />
                <BlogBlocks blocks={values.blocks.filter(drawable)} imageUrl={imageUrl} />
              </>
            )}
          </div>
        ) : (
          <BlogPostForm
            values={values}
            onChange={change}
            categories={categories}
            coverUrl={coverUrl}
            imageUrl={imageUrl}
            onChooseCover={() => choose({ kind: "cover" })}
            onRemoveCover={() => {
              setCoverPath(null);
              setValues((current) => ({ ...current, coverAlt: "" }));
            }}
            onChooseImage={(index) => choose({ kind: "image", index })}
            onSuggestSlug={() =>
              setValues((current) => ({ ...current, slug: slugFromTitle(current.title) }))
            }
            published={post?.status === "published"}
            errors={errors}
            blockErrors={blockErrors}
            disabled={saving}
          />
        )}
        <ProjectSaveBar
          note={translate(post ? "saveNote.edit" : "saveNote.new")}
          words={{
            cancel: translate("form.cancel"),
            save: translate("form.save"),
            saving: translate("form.saving"),
          }}
          saving={saving}
          onCancel={() => router.push(ADMIN_BLOG_PATH)}
          className="rounded-xl border"
        />
      </form>
    </div>
  );
}

/** A picture block with no picture chosen yet has nothing to draw in the preview. */
function drawable(block: BlogBlock): boolean {
  return block.type !== "image" || block.path !== "";
}
