import type { Metadata } from "next";
import {
  BlogAdminBoard,
  archiveBlogPost,
  getAdminBlogCounts,
  getAdminBlogList,
  getBlogCategoryUsage,
  parseAdminBlogParams,
  publishBlogPost,
  restoreBlogPost,
  trashBlogPost,
  unpublishBlogPost,
} from "@/features/blog";
import {
  createContentCategory,
  deleteContentCategory,
  getAdminCategories,
  setContentCategoryActive,
  updateContentCategory,
} from "@/features/content-categories";
import { ContentModulePageBar, getContentModulesView } from "@/features/content-modules";
import { getTranslate } from "@/features/site";
import { saveContentModules } from "@/features/site-content";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.blog.metaTitle") };
}

/**
 * The admin's Blog page (ADR-143, FR-ADM-13): the module's switch bar, then the list of articles with its status tabs,
 * category filter, search, page links and the buttons of each row, and the categories drawer. The tab, category, words
 * and page are in the address (`?status=`, `?category=`, `?q=`, `?page=`); a value that is not valid is dropped.
 * Everything is read as the signed-in admin (the role gate in the layout has already sent anyone else away) and never
 * cached, so the list is right after every change. The page keeps working while the Blog module is switched off: the
 * switch only hides it from visitors.
 */
export default async function AdminBlogPage({ searchParams }: PageProps) {
  const params = parseAdminBlogParams(await searchParams);
  const [modules, list, counts, categories, usage] = await Promise.all([
    getContentModulesView(),
    getAdminBlogList({
      status: params.status === "all" ? null : params.status,
      categoryId: params.category === "" ? null : params.category,
      query: params.query,
      page: params.page,
    }),
    getAdminBlogCounts(),
    getAdminCategories("blog"),
    getBlogCategoryUsage(),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <ContentModulePageBar module="blog" modules={modules} save={saveContentModules} />
      <BlogAdminBoard
        rows={list.rows}
        total={list.total}
        page={list.page}
        pageCount={list.pageCount}
        counts={counts}
        categories={categories}
        usage={usage}
        params={params}
        actions={{
          publish: publishBlogPost,
          unpublish: unpublishBlogPost,
          archive: archiveBlogPost,
          trash: trashBlogPost,
          restore: restoreBlogPost,
        }}
        categoryActions={{
          create: createContentCategory,
          update: updateContentCategory,
          setActive: setContentCategoryActive,
          remove: deleteContentCategory,
        }}
      />
    </div>
  );
}
