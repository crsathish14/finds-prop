import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  adminBlogHref,
  BlogEditor,
  createBlogPost,
  getAdminBlogPost,
  setBlogCover,
  updateBlogPost,
} from "@/features/blog";
import { getAdminCategories } from "@/features/content-categories";
import { getTranslate } from "@/features/site";

type PageProps = { params: Promise<{ id: string }> };

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.blog.metaTitleEdit") };
}

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The admin's edit article page (ADR-143, ADR-144): the form filled with what is stored. An address that is not an
 * article id or an article that does not exist is "not found"; one in the Trash is sent to the Trash tab of the list
 * (restore it there first, because the save refuses a trashed article). Read as the signed-in admin and never cached,
 * so the form opens with what is stored; it is keyed by the last change, so it opens again fresh after each save.
 */
export default async function EditBlogPostPage({ params }: PageProps) {
  const { id } = await params;
  if (!ID.test(id)) notFound();
  const [post, categories, translate] = await Promise.all([
    getAdminBlogPost(id.toLowerCase()),
    getAdminCategories("blog"),
    getTranslate(),
  ]);
  if (!post) notFound();
  if (post.trashed) redirect(adminBlogHref({ status: "trash" }));
  return (
    <BlogEditor
      key={post.updatedAt}
      post={post}
      categories={categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        name: category.active
          ? category.name
          : translate("admin.blog.category.hidden", { name: category.name }),
      }))}
      actions={{ create: createBlogPost, update: updateBlogPost, setCover: setBlogCover }}
    />
  );
}
