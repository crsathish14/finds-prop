"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { notify } from "@/lib/notify";
import { compareHref } from "./store";
import { useCompare } from "./use-compare.client";

type CompareRemoveProps = {
  shortId: string;
  title: string;
  cover: string | null;
  /** Every home of the comparison now, in order: the address without this one is what Remove goes to. */
  allIds: readonly string[];
  /** Design Lab only: nothing navigates or is forgotten. */
  preview?: boolean;
};

/**
 * "Remove" under a column of the comparison: takes the home out of the address (the page then shows
 * the rest) and out of the visitor's own selection if it is there, and says so with an Undo that puts
 * both back (FR-PUB-10). The page is the address's, so the removal is a replace, not a new history step.
 * In the Design Lab (`preview`) it is the button only: nothing navigates and nothing is forgotten.
 */
export function CompareRemove(props: CompareRemoveProps) {
  return props.preview ? (
    <RemoveButton title={props.title} onRemove={() => undefined} />
  ) : (
    <LiveRemove {...props} />
  );
}

function RemoveButton({ title, onRemove }: { title: string; onRemove: () => void }) {
  const translate = useTranslations("compare");
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={translate("table.removeLabel", { title })}
      iconStart={<Icon icon={X} size="sm" />}
      onClick={onRemove}
    >
      <span aria-hidden="true">{translate("table.remove")}</span>
    </Button>
  );
}

function LiveRemove({ shortId, title, cover, allIds }: CompareRemoveProps) {
  const translate = useTranslations("compare");
  const router = useRouter();
  const compare = useCompare();

  function remove() {
    const wasChosen = compare.has(shortId);
    compare.remove(shortId);
    router.replace(compareHref(allIds.filter((id) => id !== shortId)), { scroll: false });
    notify.undo(translate("removed.title"), {
      description: title,
      actionLabel: translate("removed.undo"),
      onUndo: () => {
        if (wasChosen) compare.add({ id: shortId, title, cover });
        router.replace(compareHref(allIds), { scroll: false });
      },
    });
  }

  return <RemoveButton title={title} onRemove={remove} />;
}
