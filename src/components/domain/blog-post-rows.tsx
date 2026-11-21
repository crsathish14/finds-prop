/**
 * BlogPostRows: the admin's list of Blog articles: tabs by status, a search and category filter, and a row for each.
 * Purpose: the list part of the Blog admin page (ADR-143 section 5): find an article, see its status, and publish,
 *   unpublish, archive, move to Trash or restore it from the row. Owner: design system. It holds no state: the page
 *   passes the rows, which tab and filters are chosen, and what each button does; the status tabs, the search and the
 *   category filter are an ordinary form and links, so a filtered list has its own address.
 * Props: tabs ({ value: "all" | "draft" | "published" | "archived" | "trash", count, href }), tab (the value chosen),
 *   search ({ action (the list's address), query, categoryId, categories ({ id, name }) }), rows ({ id, title, slug,
 *   status "draft" | "published" | "archived", trashed, categoryName, authorName, updatedAt (ISO), editHref, viewHref
 *   (for a published row) }), onAction (called with the row's id and "publish" | "unpublish" | "archive" | "trash" |
 *   "restore"), pendingId (the row whose button is working), error (already-translated, shown above the list),
 *   countText (already-translated, "12 articles"), className. A row in Trash offers only Restore.
 * Responsive: the tabs scroll sideways on a phone; the search box and the filter stack below 768 px; a row is a card
 *   whose buttons wrap onto as many lines as they need, so nothing widens the page.
 * Accessibility: the tabs are links in a nav, the current one marked with aria-current; every button has a visible word
 *   followed by hidden text naming the article, because several buttons share a word; the status is a word with a
 *   dot, never colour alone; an error is an alert; a working button keeps its label and is busy.
 * States: any number of rows; draft, published, archived and in Trash; a button that is working; a long title and
 *   slug; filtered with no match (the empty state says so); nothing yet; an error.
 * Dependencies: Badge, Button, Input, Select, Link, Alert, EmptyState, VisuallyHidden, format helpers, next-intl.
 * Tests: blog-admin-parts.test.tsx; Design Lab "Blog admin list" (ADR-143).
 * UX reference: none yet; drawn for the owner's approval (the Blog admin, ADR-143 section 5).
 */
import { Pencil, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";
import { Alert } from "@/components/patterns/alert";
import { EmptyState } from "@/components/patterns/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/components/ui/link";
import { Select } from "@/components/ui/select";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";

type BlogListTab = "all" | "draft" | "published" | "archived" | "trash";
type BlogRowAction = "publish" | "unpublish" | "archive" | "trash" | "restore";
type BlogRowStatus = "draft" | "published" | "archived";

type BlogPostRow = {
  id: string;
  title: string;
  slug: string;
  status: BlogRowStatus;
  trashed: boolean;
  categoryName?: string | null | undefined;
  authorName: string;
  updatedAt: string;
  editHref: string;
  viewHref?: string | undefined;
};

type BlogPostRowsProps = {
  tabs: readonly { value: BlogListTab; count: number; href: string }[];
  tab: BlogListTab;
  search: {
    action: string;
    query?: string | undefined;
    categoryId?: string | undefined;
    categories: readonly { id: string; name: string }[];
  };
  rows: readonly BlogPostRow[];
  onAction: (id: string, action: BlogRowAction) => void;
  pendingId?: string | undefined;
  error?: string | undefined;
  countText?: string | undefined;
  className?: string;
};

const TAB_WORDS = {
  all: "admin.blog.list.tabs.all",
  draft: "admin.blog.list.tabs.draft",
  published: "admin.blog.list.tabs.published",
  archived: "admin.blog.list.tabs.archived",
  trash: "admin.blog.list.tabs.trash",
} as const satisfies Record<BlogListTab, string>;

const STATUS_WORDS = {
  draft: "admin.blog.list.status.draft",
  published: "admin.blog.list.status.published",
  archived: "admin.blog.list.status.archived",
} as const satisfies Record<BlogRowStatus, string>;

const STATUS_TONES = { draft: "neutral", published: "success", archived: "warning" } as const;

const ACTION_WORDS = {
  publish: "admin.blog.list.actions.publish",
  unpublish: "admin.blog.list.actions.unpublish",
  archive: "admin.blog.list.actions.archive",
  trash: "admin.blog.list.actions.trash",
  restore: "admin.blog.list.actions.restore",
} as const satisfies Record<BlogRowAction, string>;

/** Which buttons a row offers: a row in Trash only comes back; any other can be published or taken down, archived or binned. */
function actionsOf(row: BlogPostRow): BlogRowAction[] {
  if (row.trashed) return ["restore"];
  const actions: BlogRowAction[] = [row.status === "published" ? "unpublish" : "publish"];
  if (row.status !== "archived") actions.push("archive");
  actions.push("trash");
  return actions;
}

function BlogPostRows({
  tabs,
  tab,
  search,
  rows,
  onAction,
  pendingId,
  error,
  countText,
  className,
}: BlogPostRowsProps) {
  const translate = useTranslations();
  const locale = useLocale();
  const queryId = useId();
  const filtering = Boolean(search.query) || Boolean(search.categoryId);

  return (
    <div data-slot="blog-post-rows" className={cn("flex min-w-0 flex-col gap-5", className)}>
      <nav aria-label={translate("admin.blog.list.tabsLabel")} className="overflow-x-auto">
        <ul className="flex w-max min-w-full gap-2">
          {tabs.map((entry) => (
            <li key={entry.value}>
              <Link
                href={entry.href}
                aria-current={entry.value === tab ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-(--size-chip) items-center gap-2 rounded-pill border-[length:var(--bw-field)] px-4 text-small font-semibold whitespace-nowrap no-underline",
                  entry.value === tab
                    ? "border-primary bg-primary-tint text-primary"
                    : "border-line-strong bg-surface text-ink hover:border-primary",
                )}
              >
                {translate(TAB_WORDS[entry.value])}
                <span className="tabular-nums text-muted">{entry.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <form
        role="search"
        action={search.action}
        method="get"
        className="flex flex-col gap-3 md:flex-row md:items-end"
      >
        {tab !== "all" ? <input type="hidden" name="status" value={tab} /> : null}
        <div className="min-w-0 flex-1">
          <VisuallyHidden>
            <Label htmlFor={queryId}>{translate("admin.blog.list.searchLabel")}</Label>
          </VisuallyHidden>
          <Input
            id={queryId}
            name="q"
            type="search"
            defaultValue={search.query ?? ""}
            placeholder={translate("admin.blog.list.searchPlaceholder")}
            leading={<Icon icon={Search} />}
          />
        </div>
        <div className="md:w-64">
          <Select
            name="category"
            defaultValue={search.categoryId ?? ""}
            aria-label={translate("admin.blog.list.categoryLabel")}
          >
            <option value="">{translate("admin.blog.list.allCategories")}</option>
            {search.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          {translate("admin.blog.list.apply")}
        </Button>
      </form>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {countText ? (
        <p className="text-small text-muted" aria-live="polite">
          {countText}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title={translate(
            filtering ? "admin.blog.list.noMatchTitle" : "admin.blog.list.emptyTitle",
          )}
          description={translate(
            filtering ? "admin.blog.list.noMatchText" : "admin.blog.list.emptyText",
          )}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li
              key={row.id}
              data-status={row.trashed ? "trash" : row.status}
              className="flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={row.editHref}
                    className="text-title-sm font-semibold text-primary [overflow-wrap:anywhere]"
                  >
                    {row.title}
                  </Link>
                  {row.trashed ? (
                    <Badge dot tone="danger">
                      {translate("admin.blog.list.status.trash")}
                    </Badge>
                  ) : (
                    <Badge dot tone={STATUS_TONES[row.status]}>
                      {translate(STATUS_WORDS[row.status])}
                    </Badge>
                  )}
                </div>
                <p className="text-caption text-muted [overflow-wrap:anywhere]">
                  {translate("admin.blog.list.address", { slug: row.slug })}
                </p>
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-muted">
                  {row.categoryName ? <span>{row.categoryName}</span> : null}
                  <span>{row.authorName}</span>
                  <span>
                    {translate("admin.blog.list.updated", {
                      date: formatDate(locale, row.updatedAt),
                    })}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {row.trashed ? null : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={row.editHref} className="no-underline">
                      <Icon icon={Pencil} />
                      <span>{translate("admin.blog.list.actions.edit")}</span>{" "}
                      <VisuallyHidden>{row.title}</VisuallyHidden>
                    </Link>
                  </Button>
                )}
                {actionsOf(row).map((action) => (
                  <Button
                    key={action}
                    type="button"
                    variant={action === "trash" ? "danger-outline" : "secondary"}
                    size="sm"
                    loading={pendingId === row.id}
                    disabled={pendingId !== undefined && pendingId !== row.id}
                    onClick={() => onAction(row.id, action)}
                  >
                    {translate(ACTION_WORDS[action])} <VisuallyHidden>{row.title}</VisuallyHidden>
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { BlogPostRows };
export type { BlogListTab, BlogPostRow, BlogRowAction };
