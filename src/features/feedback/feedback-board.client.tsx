"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/patterns/empty-state";
import { PaginationBar } from "@/components/patterns/pagination-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { failureText, type Translator } from "@/i18n/failure-text";
import { formatDate, formatTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import { ADMIN_FEEDBACK_PATH, FEEDBACK_STATES, type FeedbackState } from "./constants";
import type { FeedbackCounts, FeedbackPage } from "./view";

export type FeedbackBoardActions = {
  setReviewed: (input: { feedbackId: string; reviewed: boolean }) => Promise<ActionResult<unknown>>;
};

/** The address of a page of the list: the default filter and the first page are left out. */
function hrefFor(state: FeedbackState, page: number): string {
  const query = new URLSearchParams();
  if (state !== "open") query.set("state", state);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `${ADMIN_FEEDBACK_PATH}?${text}` : ADMIN_FEEDBACK_PATH;
}

/**
 * The super admin's Feedback page (change request, plan 6): every message from a builder or an agent with who sent it,
 * their role, when, and the text, newest first. The filter (Not reviewed, Reviewed, All) and the page number live in the
 * address, so a list can be linked and the back button works. Each message has one button that switches its review
 * flag; the page is read again after a change, so it shows what the server holds.
 */
export function FeedbackBoard({
  page,
  counts,
  actions,
}: {
  page: FeedbackPage;
  counts: FeedbackCounts;
  actions: FeedbackBoardActions;
}) {
  const translate = useTranslations("admin.feedback");
  const everything = useTranslations() as unknown as Translator;
  const locale = useLocale();
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);

  const toggle = async (id: string, reviewed: boolean) => {
    if (saving) return;
    setSaving(id);
    try {
      const result = await actions.setReviewed({ feedbackId: id, reviewed });
      if (!result.ok) {
        notify.error(failureText(everything, result));
        return;
      }
      notify.success(translate(reviewed ? "toast.reviewed" : "toast.unreviewed"));
    } finally {
      setSaving(null);
      router.refresh();
    }
  };

  const numbers: Record<FeedbackState, number> = {
    all: counts.total,
    open: counts.notReviewed,
    reviewed: counts.total - counts.notReviewed,
  };

  const filterLabel = (state: FeedbackState): string => {
    if (state === "open") return translate("filter.open", { count: numbers.open });
    if (state === "reviewed") return translate("filter.reviewed", { count: numbers.reviewed });
    return translate("filter.all", { count: numbers.all });
  };
  const emptyTitle = (): string => {
    if (page.state === "open") return translate("empty.open.title");
    if (page.state === "reviewed") return translate("empty.reviewed.title");
    return translate("empty.all.title");
  };
  const emptyDescription = (): string => {
    if (page.state === "open") return translate("empty.open.description");
    if (page.state === "reviewed") return translate("empty.reviewed.description");
    return translate("empty.all.description");
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Heading as="h1" size="1">
          {translate("title")}
        </Heading>
        <Text tone="muted">{translate("intro")}</Text>
      </div>
      <nav aria-label={translate("filterLabel")} className="flex flex-wrap gap-2">
        {FEEDBACK_STATES.map((state) => (
          <Link
            key={state}
            href={hrefFor(state, 1)}
            aria-current={state === page.state ? "page" : undefined}
            className={
              state === page.state
                ? "rounded-pill bg-primary px-4 py-2 text-small text-on-primary no-underline"
                : "rounded-pill border border-line-strong px-4 py-2 text-small text-ink no-underline"
            }
          >
            {filterLabel(state)}
          </Link>
        ))}
      </nav>
      {page.items.length === 0 ? (
        <EmptyState title={emptyTitle()} description={emptyDescription()} />
      ) : (
        <ul className="flex flex-col gap-3">
          {page.items.map((item) => {
            const reviewed = item.reviewedAt !== null;
            return (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-card"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Text variant="title" as="span">
                    {item.builderName}
                  </Text>
                  <Badge tone={item.kind === "agent" ? "info" : "neutral"}>
                    {translate(item.kind === "agent" ? "role.agent" : "role.builder")}
                  </Badge>
                  <Badge tone={reviewed ? "success" : "warning"}>
                    {translate(reviewed ? "state.reviewed" : "state.open")}
                  </Badge>
                  <Text variant="small" tone="muted" as="span">
                    {`${formatDate(locale, item.createdAt, "medium")}, ${formatTime(locale, item.createdAt)}`}
                  </Text>
                </div>
                <Text className="whitespace-pre-wrap break-words">{item.message}</Text>
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={saving === item.id}
                    disabled={saving !== null}
                    onClick={() => void toggle(item.id, !reviewed)}
                  >
                    {translate(reviewed ? "markNotReviewed" : "markReviewed")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <PaginationBar
        page={page.page}
        pageCount={page.pageCount}
        hrefFor={(number) => hrefFor(page.state, number)}
      />
    </div>
  );
}
