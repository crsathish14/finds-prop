"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FaqManager, type FaqRow } from "@/components/domain/faq-manager";
import type { CategoryView } from "@/features/content-categories";
import { failureText, type Translator } from "@/i18n/failure-text";
import { formatDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import type { FaqAdminViewName } from "./constants";
import { FaqCategoriesPanel, type FaqCategoriesActions } from "./faq-categories-panel.client";
import type { FaqDone, FaqReorderDone } from "./faq-service";
import { adminFaqHref, type AdminFaqParams } from "./page-params";
import { filterAdminFaqs, type FaqAdminView } from "./view";

export type FaqBoardActions = {
  publish: (input: { faqId: string }) => Promise<ActionResult<FaqDone>>;
  unpublish: (input: { faqId: string }) => Promise<ActionResult<FaqDone>>;
  trash: (input: { faqId: string }) => Promise<ActionResult<FaqDone>>;
  restore: (input: { faqId: string }) => Promise<ActionResult<FaqDone>>;
  reorder: (input: {
    categoryId: string;
    faqIds: string[];
  }) => Promise<ActionResult<FaqReorderDone>>;
};

type FaqAdminBoardProps = {
  /** Every question that is not in the Trash, drafts too, in the admin's order. */
  faqs: FaqAdminView[];
  /** The questions in the Trash. */
  trashed: FaqAdminView[];
  /** The categories of the FAQ list, hidden ones too. */
  categories: CategoryView[];
  /** What the address chose: the tab, the category (an id) and the words. */
  params: AdminFaqParams;
  actions: FaqBoardActions;
  categoryActions: FaqCategoriesActions;
};

/** How long to wait after the last key before the search is put in the address. */
const SEARCH_DELAY = 350;

/**
 * The admin's FAQ list (ADR-143, FR-ADM-13): the tab, the category and the words are in the address, so a view can be
 * shared and survives a refresh; the list is narrowed here from the questions the page read (the whole list is short).
 * It calls the actions it is given; after each change the page is read again, so what shows is what is stored. The
 * order buttons show only for one whole category (no words, not a single status), because that is the only list where
 * "up" and "down" mean something. A question that is already gone answers "not found": a toast says so and the list
 * is refreshed.
 */
export function FaqAdminBoard({
  faqs,
  trashed,
  categories,
  params,
  actions,
  categoryActions,
}: FaqAdminBoardProps) {
  const translate = useTranslations("admin.faq");
  const everything = useTranslations() as unknown as Translator;
  const locale = useLocale();
  const router = useRouter();

  const [search, setSearch] = useState(params.query);
  const [busy, setBusy] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // The words are put in the address a moment after the last key, so each letter does not read the page again.
  useEffect(() => {
    const typed = search.trim();
    if (typed === params.query) return;
    const timer = window.setTimeout(() => {
      router.replace(adminFaqHref({ ...params, query: typed }));
    }, SEARCH_DELAY);
    return () => window.clearTimeout(timer);
  }, [search, params, router]);

  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name ?? "";

  const inTrash = params.view === "trash";
  const visible = filterAdminFaqs(inTrash ? trashed : faqs, {
    view: params.view,
    categoryId: params.category,
    query: search,
  });

  // The order of one whole category: no words, not a single status, not the Trash.
  const reorderable = params.category !== "" && params.view === "all" && search.trim() === "";

  const report = (failure: Extract<ActionResult<unknown>, { ok: false }>) => {
    notify.error(
      failure.code === "NOT_FOUND" || failure.code === "CONFLICT"
        ? translate("conflict")
        : failureText(everything, failure),
    );
    router.refresh();
  };

  const run = async (call: () => Promise<ActionResult<unknown>>, message: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await call();
      if (result.ok) {
        notify.success(message);
        router.refresh();
      } else {
        report(result);
      }
    } finally {
      setBusy(false);
    }
  };

  const move = (faq: FaqAdminView, step: -1 | 1) => {
    const ids = visible.map((one) => one.id);
    const index = ids.indexOf(faq.id);
    const target = index + step;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target] as string, ids[index] as string];
    void run(
      () => actions.reorder({ categoryId: faq.categoryId, faqIds: ids }),
      translate("toast.moved"),
    );
  };

  const rows: FaqRow[] = visible.map((faq, index) => {
    const forName = translate("actions.forQuestion", { question: faq.question });
    const isTrashed = faq.deletedAt !== null;
    return {
      id: faq.id,
      question: faq.question,
      categoryName: categoryName(faq.categoryId),
      status: faq.status,
      statusLabel: isTrashed
        ? translate("status.trash")
        : translate(faq.status === "published" ? "status.published" : "status.draft"),
      updated: formatDate(locale, faq.updatedAt),
      ...(isTrashed ? { trashed: true } : {}),
      editHref: `/admin/faq/${faq.id}`,
      editLabel: translate("actions.edit"),
      editFor: forName,
      toggle: isTrashed
        ? {
            label: translate("actions.restore"),
            forName,
            onClick: () =>
              void run(() => actions.restore({ faqId: faq.id }), translate("toast.restored")),
          }
        : faq.status === "published"
          ? {
              label: translate("actions.unpublish"),
              forName,
              onClick: () =>
                void run(
                  () => actions.unpublish({ faqId: faq.id }),
                  translate("toast.unpublished"),
                ),
            }
          : {
              label: translate("actions.publish"),
              forName,
              onClick: () =>
                void run(() => actions.publish({ faqId: faq.id }), translate("toast.published")),
            },
      ...(isTrashed
        ? {}
        : {
            trash: {
              label: translate("actions.trash", { question: faq.question }),
              onClick: () =>
                void run(() => actions.trash({ faqId: faq.id }), translate("toast.trashed")),
            },
          }),
      ...(reorderable
        ? {
            moveUp: {
              label: translate("actions.moveUp", { question: faq.question }),
              onClick: () => move(faq, -1),
              disabled: index === 0,
            },
            moveDown: {
              label: translate("actions.moveDown", { question: faq.question }),
              onClick: () => move(faq, 1),
              disabled: index === visible.length - 1,
            },
          }
        : {}),
    };
  });

  const tabCounts: Record<FaqAdminViewName, number> = {
    all: faqs.length,
    published: faqs.filter((faq) => faq.status === "published").length,
    draft: faqs.filter((faq) => faq.status === "draft").length,
    trash: trashed.length,
  };
  const total = inTrash ? trashed.length : faqs.length;

  // Questions per category, the Trash included: a category that holds only trashed questions still cannot be deleted.
  const usage: Record<string, number> = {};
  for (const faq of [...faqs, ...trashed]) usage[faq.categoryId] = (usage[faq.categoryId] ?? 0) + 1;

  return (
    <>
      <FaqManager
        title={translate("title")}
        intro={translate("intro")}
        addLabel={translate("add")}
        addHref="/admin/faq/new"
        categoriesLabel={translate("categoriesButton")}
        onCategories={() => setCategoriesOpen(true)}
        headingLevel="h1"
        tabs={{
          label: translate("tabs.label"),
          options: [
            { value: "all", label: translate("tabs.all"), count: tabCounts.all },
            { value: "published", label: translate("tabs.published"), count: tabCounts.published },
            { value: "draft", label: translate("tabs.drafts"), count: tabCounts.draft },
            { value: "trash", label: translate("tabs.trash"), count: tabCounts.trash },
          ],
          value: params.view,
          onChange: (value) =>
            router.replace(
              adminFaqHref({ ...params, view: value as FaqAdminViewName, query: search.trim() }),
            ),
        }}
        category={{
          label: translate("category.label"),
          allLabel: translate("category.all"),
          options: categories.map((category) => ({
            value: category.id,
            label: category.active
              ? category.name
              : translate("category.hidden", { name: category.name }),
          })),
          value: params.category,
          onChange: (value) =>
            router.replace(adminFaqHref({ ...params, category: value, query: search.trim() })),
        }}
        search={{
          value: search,
          onChange: setSearch,
          label: translate("search.label"),
          placeholder: translate("search.placeholder"),
        }}
        columns={{
          question: translate("columns.question"),
          category: translate("columns.category"),
          status: translate("columns.status"),
          updated: translate("columns.updated"),
          actions: translate("columns.actions"),
        }}
        caption={translate("caption")}
        rows={rows}
        countText={translate("count", { shown: rows.length, total })}
        {...(reorderable ? {} : { note: translate("orderNote") })}
        empty={{ title: translate("empty.title"), text: translate("empty.text") }}
        noMatches={{ title: translate("noMatches.title"), text: translate("noMatches.text") }}
        pending={busy}
      />
      <FaqCategoriesPanel
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        categories={categories}
        usage={usage}
        actions={categoryActions}
      />
    </>
  );
}
