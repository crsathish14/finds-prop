"use client";

import { useEffect } from "react";
import { CompareBarView } from "./compare-bar.client";
import { COMPARE_MAX, COMPARE_MIN } from "./store";
import { useCompare } from "./use-compare.client";

/**
 * The compare selection inside the AI chat (AI chat compare, 16 Nov 2026). It does two things with the one list the
 * cards' Compare checkboxes fill: it tells the chat which homes are ticked (public ids only, at most three, and
 * nothing at all while fewer than two are ticked), and it draws the existing compare bar in the flow, with its
 * "Compare now" link to the comparison, once two or more are ticked. The bar's own remove and Clear all buttons
 * work as everywhere else.
 */
export function CompareChatBar({ onIds }: { onIds: (ids: readonly string[]) => void }) {
  const compare = useCompare();
  const ids = compare.ids.slice(0, COMPARE_MAX);
  const ready = ids.length >= COMPARE_MIN;
  const key = ready ? ids.join(",") : "";

  useEffect(() => {
    onIds(key === "" ? [] : key.split(","));
    return () => onIds([]);
  }, [key, onIds]);

  if (!ready) return null;
  return (
    <CompareBarView
      entries={compare.list.slice(0, COMPARE_MAX)}
      placement="inline"
      onRemove={compare.remove}
      onClear={compare.clear}
    />
  );
}
