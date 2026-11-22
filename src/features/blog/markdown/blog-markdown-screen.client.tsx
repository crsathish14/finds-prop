"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BlogMarkdownFlow, type MarkdownCreateInput } from "@/components/domain/blog-markdown-flow";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import { ADMIN_BLOG_NEW_PATH, adminBlogEditPath } from "../page-params";
import type { PostDone } from "../post-service";
import { convertMarkdown } from "./convert";

export type BlogMarkdownActions = {
  /** Makes a draft from pasted Markdown, converting it again on the server (ADR-172). */
  create: (input: {
    markdown: string;
    title: string;
    slug?: string;
    excerpt: string;
    authorName: string;
    categoryId: string | null;
  }) => Promise<ActionResult<PostDone>>;
};

type BlogMarkdownScreenProps = {
  categories: { id: string; name: string }[];
  initialCategory?: string;
  actions: BlogMarkdownActions;
};

/** The boxes of the flow that a failure can name; anything else is shown as one message. */
const BOXES = ["markdown", "title", "slug", "authorName", "categoryId", "excerpt"] as const;

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
}: BlogMarkdownScreenProps) {
  const everything = useTranslations() as unknown as Translator;
  const router = useRouter();

  const create = async (input: MarkdownCreateInput) => {
    const result = await actions.create({
      markdown: input.markdown,
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
    return { ok: false as const, errors };
  };

  return (
    <BlogMarkdownFlow
      categories={categories}
      initialCategory={initialCategory}
      convert={convertMarkdown}
      onCreate={create}
      backHref={ADMIN_BLOG_NEW_PATH}
    />
  );
}
