import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { BlogMethodChooser } from "@/components/domain/blog-markdown-flow-chooser";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import {
  ADMIN_BLOG_NEW_PATH,
  ADMIN_BLOG_PATH,
  BlogEditor,
  BlogMarkdownScreen,
  createBlogPost,
  createBlogPostFromMarkdown,
  setBlogCover,
  updateBlogPost,
} from "@/features/blog";
import { getAdminCategories } from "@/features/content-categories";
import { getTranslate } from "@/features/site";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.blog.metaTitleNew") };
}

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * The admin's new article page (ADR-143, ADR-172). With no `method` it asks how to start: the block editor (ADR-144) or
 * pasted Markdown. `?method=blocks` is the article form, in the category the list was narrowed to when it is one of
 * ours; `?method=markdown` is the paste flow. A new article is a draft until the admin publishes it from the list. The
 * categories are read as the signed-in admin.
 */
export default async function NewBlogPostPage({ searchParams }: PageProps) {
  const [raw, translate, categories] = await Promise.all([
    searchParams,
    getTranslate(),
    getAdminCategories("blog"),
  ]);
  const asked = first(raw["category"]);
  const method = first(raw["method"]);
  const initialCategory =
    asked && categories.some((category) => category.id === asked) ? asked : undefined;
  const choices = categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.active
      ? category.name
      : translate("admin.blog.category.hidden", { name: category.name }),
  }));

  if (method === "blocks") {
    return (
      <BlogEditor
        post={null}
        categories={choices}
        {...(initialCategory ? { initialCategory } : {})}
        actions={{ create: createBlogPost, update: updateBlogPost, setCover: setBlogCover }}
      />
    );
  }
  if (method === "markdown") {
    return (
      <BlogMarkdownScreen
        categories={choices.map(({ id, name }) => ({ id, name }))}
        {...(initialCategory ? { initialCategory } : {})}
        actions={{ create: createBlogPostFromMarkdown }}
      />
    );
  }
  const href = (choice: string): string => {
    const search = new URLSearchParams({ method: choice });
    if (initialCategory) search.set("category", initialCategory);
    return `${ADMIN_BLOG_NEW_PATH}?${search.toString()}`;
  };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={ADMIN_BLOG_PATH}
          variant="nav"
          className="inline-flex items-center gap-2 text-small"
        >
          <Icon icon={ArrowLeft} size="sm" />
          {translate("admin.blog.back")}
        </Link>
        <Heading as="h1" size="1">
          {translate("admin.blog.newTitle")}
        </Heading>
      </div>
      <BlogMethodChooser blocksHref={href("blocks")} markdownHref={href("markdown")} />
    </div>
  );
}
