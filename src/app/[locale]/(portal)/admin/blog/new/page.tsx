import type { Metadata } from "next";
import { BlogEditor, createBlogPost, setBlogCover, updateBlogPost } from "@/features/blog";
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

/**
 * The admin's new article page (ADR-143): the article form, in the category the list was narrowed to when it is one of
 * ours. A new article is a draft until the admin publishes it from the list. The categories are read as the signed-in
 * admin.
 */
export default async function NewBlogPostPage({ searchParams }: PageProps) {
  const [raw, translate, categories] = await Promise.all([
    searchParams,
    getTranslate(),
    getAdminCategories("blog"),
  ]);
  const asked = Array.isArray(raw["category"]) ? raw["category"][0] : raw["category"];
  return (
    <BlogEditor
      post={null}
      categories={categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        name: category.active
          ? category.name
          : translate("admin.blog.category.hidden", { name: category.name }),
      }))}
      {...(asked && categories.some((category) => category.id === asked)
        ? { initialCategory: asked }
        : {})}
      actions={{ create: createBlogPost, update: updateBlogPost, setCover: setBlogCover }}
    />
  );
}
