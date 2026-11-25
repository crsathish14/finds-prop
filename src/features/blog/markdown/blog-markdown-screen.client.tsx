"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { BlogMarkdownFlow, type MarkdownCreateInput } from "@/components/domain/blog-markdown-flow";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import { createBlogStorage, type BlogStorage } from "../blog-storage";
import { extensionOf, PICTURE_ACCEPT, randomToken } from "../blog-pictures";
import { BLOG_IMAGE_MAX_BYTES, BLOG_IMAGE_MAX_KB, blogImageFolder } from "../constants";
import { ADMIN_BLOG_NEW_PATH, adminBlogEditPath } from "../page-params";
import type { PostDone } from "../post-service";
import { buildAiPrompt } from "./ai-prompt";
import { convertMarkdown } from "./convert";

/** What a picture file may be on the paste screen: the same rules the block editor uses. */
const PICTURE_RULES = {
  accept: PICTURE_ACCEPT,
  limitBytes: BLOG_IMAGE_MAX_BYTES,
  extension: extensionOf,
  maximumKb: BLOG_IMAGE_MAX_KB,
};
const AI_PROMPT = buildAiPrompt();

export type BlogMarkdownActions = {
  /** Makes a draft from pasted Markdown, converting it again on the server (ADR-172). */
  create: (input: {
    markdown: string;
    title: string;
    slug?: string;
    excerpt: string;
    authorName: string;
    categoryId: string | null;
    /** The id the article is made with, set when pictures are sent (their files are in its folder already). */
    postId?: string;
    pictures?: { slot: string; path: string; alt: string }[];
  }) => Promise<ActionResult<PostDone>>;
};

type BlogMarkdownScreenProps = {
  categories: { id: string; name: string }[];
  initialCategory?: string;
  actions: BlogMarkdownActions;
  /** The bucket the chosen pictures are sent to (the tests give their own); the real one by default. */
  storage?: BlogStorage;
};

/** The boxes of the flow that a failure can name; anything else is shown as one message. */
const BOXES = [
  "markdown",
  "pictures",
  "title",
  "slug",
  "authorName",
  "categoryId",
  "excerpt",
] as const;

/**
 * The single entry point of the Markdown flow (ADR-172): the paste screen wired to the converter (for the live
 * preview) and to the server action (which converts again and saves the draft). A made draft opens in the normal block
 * editor. Everything of the flow outside `components/domain/blog-markdown-flow*.tsx` and this folder is the page that
 * chooses between the two ways, so removing the flow is removing these files and that choice.
 */
export function BlogMarkdownScreen({
  categories,
  initialCategory = "",
  actions,
  storage,
}: BlogMarkdownScreenProps) {
  const everything = useTranslations() as unknown as Translator;
  const router = useRouter();
  const bucket = useRef<BlogStorage | null>(storage ?? null);

  const create = async (input: MarkdownCreateInput) => {
    // A picture's folder is named after the article, so the browser chooses the id first, sends each file to that
    // folder, and the server then reads every file back and makes the draft with this id (ADR-173).
    const postId = input.pictures.length > 0 ? crypto.randomUUID() : undefined;
    const uploaded: string[] = [];
    const sent: { slot: string; path: string; alt: string }[] = [];
    if (postId !== undefined) {
      bucket.current ??= createBlogStorage();
      for (const picture of input.pictures) {
        const path = `${blogImageFolder(postId)}${randomToken()}.${picture.extension}`;
        if (!(await bucket.current.upload(path, picture.file))) {
          await bucket.current.remove(uploaded);
          return {
            ok: false as const,
            errors: { pictures: everything("admin.blog.markdown.pictures.uploadFailed") },
          };
        }
        uploaded.push(path);
        sent.push({ slot: picture.slot, path, alt: picture.alt });
      }
    }
    const result = await actions.create({
      markdown: input.markdown,
      ...(postId === undefined ? {} : { postId, pictures: sent }),
      title: input.title,
      ...(input.slug === "" ? {} : { slug: input.slug }),
      excerpt: input.excerpt,
      authorName: input.authorName,
      categoryId: input.categoryId,
    });
    if (result.ok) {
      notify.success(everything("admin.blog.toast.created"));
      router.push(adminBlogEditPath(result.data.postId));
      return { ok: true as const };
    }
    const errors: Partial<Record<string, string>> = {};
    for (const [field, problems] of Object.entries(result.fieldErrors ?? {})) {
      const first = problems[0];
      if (!first) continue;
      const box = (BOXES as readonly string[]).includes(field) ? field : "_form";
      errors[box] ??= fieldErrorText(everything, first);
    }
    if (Object.keys(errors).length === 0) errors["_form"] = failureText(everything, result);
    // A refused draft leaves no picture behind in the bucket.
    await bucket.current?.remove(uploaded);
    return { ok: false as const, errors };
  };

  return (
    <BlogMarkdownFlow
      categories={categories}
      initialCategory={initialCategory}
      convert={convertMarkdown}
      aiPrompt={AI_PROMPT}
      pictureRules={PICTURE_RULES}
      onCreate={create}
      backHref={ADMIN_BLOG_NEW_PATH}
    />
  );
}
