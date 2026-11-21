"use client";

import { Plus, Tags } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BlogPostRows,
  type BlogListTab,
  type BlogPostRow,
  type BlogRowAction,
} from "@/components/domain/blog-post-rows";
import { PaginationBar } from "@/components/patterns/pagination-bar";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import type { CategoryView } from "@/features/content-categories";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import { BlogCategoriesPanel, type BlogCategoriesActions } from "./blog-categories-panel.client";
import type { PostDone } from "./post-service";
import {
  ADMIN_BLOG_NEW_PATH,
  adminBlogEditPath,
  adminBlogHref,
  ADMIN_BLOG_PATH,
  type AdminBlogParams,
} from "./page-params";
import type { AdminBlogRowView } from "./view";

export type BlogBoardActions = {
  publish: (input: { postId: string }) => Promise<ActionResult<PostDone>>;
  unpublish: (input: { postId: string }) => Promise<ActionResult<PostDone>>;
  archive: (input: { postId: string }) => Promise<ActionResult<PostDone>>;
  trash: (input: { postId: string }) => Promise<ActionResult<PostDone>>;
  restore: (input: { postId: string }) => Promise<ActionResult<PostDone>>;
};

type BlogAdminBoardProps = {
  /** One page of the list, in the admin's order (the newest edit first). */
  rows: AdminBlogRowView[];
  /** How many articles the chosen tab and filters hold, and which page this is. */
  total: number;
  page: number;
  pageCount: number;
  /** How many articles each tab holds. */
  counts: { draft: number; published: number; archived: number; trash: number };
  /** The categories of the Blog, hidden ones too. */
  categories: CategoryView[];
  /** How many articles (the Trash too) each category holds, by category id. */
  usage: Record<string, number>;
  /** What the address chose: the tab, the category (an id), the words and the page. */
  params: AdminBlogParams;
  actions: BlogBoardActions;
  categoryActions: BlogCategoriesActions;
};

/** The words of each button's confirmation (static keys, so the messages check can see them). */
const TOAST_WORDS = {
  publish: "admin.blog.toast.published",
  unpublish: "admin.blog.toast.unpublished",
  archive: "admin.blog.toast.archived",
  trash: "admin.blog.toast.trashed",
  restore: "admin.blog.toast.restored",
} as const satisfies Record<BlogRowAction, string>;

const TABS: readonly BlogListTab[] = ["all", "draft", "published", "archived", "trash"];

/**
 * The admin's Blog list (ADR-143, FR-ADM-13): the page heading with New article and Categories, then the shared rows
 * part (tabs, search, category filter, and Publish, Unpublish, Archive, Move to Trash or Restore on each row). The
 * tab, the category, the words and the page are in the address (links and a plain form), so a view can be shared and
 * survives a refresh; the page reads the rows. Each button calls the action it is given and the page is read again, so
 * what shows is what is stored. A refusal (an article with no summary cannot be published) says why above the list;
 * an article that is already gone says so and the list is refreshed.
 */
export function BlogAdminBoard({
  rows,
  total,
  page,
  pageCount,
  counts,
  categories,
  usage,
  params,
  actions,
  categoryActions,
}: BlogAdminBoardProps) {
  const translate = useTranslations("admin.blog");
  const everything = useTranslations() as unknown as Translator;
  const router = useRouter();

  const [pendingId, setPendingId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const nameOf = (id: string | null) =>
    id === null ? null : (categories.find((category) => category.id === id)?.name ?? null);

  const refused = (failure: Extract<ActionResult<unknown>, { ok: false }>): string => {
    if (failure.code === "NOT_FOUND" || failure.code === "CONFLICT") return translate("conflict");
    const first = Object.values(failure.fieldErrors ?? {})[0]?.[0];
    return first ? fieldErrorText(everything, first) : failureText(everything, failure);
  };

  const onAction = async (id: string, action: BlogRowAction) => {
    if (pendingId !== undefined) return;
    setPendingId(id);
    setError(undefined);
    try {
      const result = await actions[action]({ postId: id });
      if (result.ok) {
        notify.success(everything(TOAST_WORDS[action]));
        router.refresh();
        return;
      }
      const text = refused(result);
      setError(text);
      notify.error(text);
      if (result.code === "NOT_FOUND" || result.code === "CONFLICT") router.refresh();
    } finally {
      setPendingId(undefined);
    }
  };

  const tabCount: Record<BlogListTab, number> = {
    all: counts.draft + counts.published + counts.archived,
    draft: counts.draft,
    published: counts.published,
    archived: counts.archived,
    trash: counts.trash,
  };

  const listRows: BlogPostRow[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    trashed: row.trashed,
    categoryName: nameOf(row.categoryId),
    authorName: row.authorName,
    updatedAt: row.updatedAt,
    editHref: adminBlogEditPath(row.id),
  }));

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 max-w-2xl flex-col gap-2">
            <Heading as="h1" size="1">
              {translate("title")}
            </Heading>
            <Text tone="muted">{translate("intro")}</Text>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setCategoriesOpen(true)}>
              <Icon icon={Tags} />
              {translate("categoriesButton")}
            </Button>
            <Button asChild variant="primary">
              <Link href={ADMIN_BLOG_NEW_PATH} variant="nav" className="no-underline">
                <Icon icon={Plus} />
                {translate("add")}
              </Link>
            </Button>
          </div>
        </div>
        <BlogPostRows
          tabs={TABS.map((value) => ({
            value,
            count: tabCount[value],
            href: adminBlogHref({ ...params, status: value, page: 1 }),
          }))}
          tab={params.status}
          search={{
            action: ADMIN_BLOG_PATH,
            query: params.query,
            categoryId: params.category,
            categories: categories.map((category) => ({
              id: category.id,
              name: category.active
                ? category.name
                : translate("category.hidden", { name: category.name }),
            })),
          }}
          rows={listRows}
          onAction={(id, action) => void onAction(id, action)}
          pendingId={pendingId}
          error={error}
          countText={translate("count", { count: total })}
        />
        <PaginationBar
          page={page}
          pageCount={pageCount}
          hrefFor={(number) => adminBlogHref({ ...params, page: number })}
        />
      </div>
      <BlogCategoriesPanel
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        categories={categories}
        usage={usage}
        actions={categoryActions}
      />
    </>
  );
}
