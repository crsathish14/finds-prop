"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ContentModuleId, ContentModuleStatus } from "@/components/domain/content-module-bar";
import type { ContentModuleRow } from "@/components/domain/content-modules-card";
import { failureText, type Translator } from "@/i18n/failure-text";
import type { ActionResult } from "@/types/action";
import type { ContentModuleSwitches, ContentModulesView } from "./view";

/** The save action of the switches (it takes all three together, so a save replaces the whole setting). */
export type SaveContentModules = (input: ContentModuleSwitches) => Promise<ActionResult<unknown>>;

type Outcome = { module: ContentModuleId; status: ContentModuleStatus; problem?: string };

function switchesOf(view: ContentModulesView): ContentModuleSwitches {
  const switches: ContentModuleSwitches = { blog: true, faq: true, careers: true };
  for (const item of view) switches[item.module] = item.live;
  return switches;
}

/**
 * What the dashboard card and the bar on each module's page share (ADR-143): the saved switches, the save with its
 * outcome (saving, saved, or failed with the reason in words) and the rows to draw. The server's view is the truth:
 * after a save, and after a failed one, the page is read again, and a new view from the server replaces what is held.
 * One save at a time, because every save writes all three switches.
 */
export function useContentModuleSwitches(view: ContentModulesView, save: SaveContentModules) {
  const everything = useTranslations() as unknown as Translator;
  const router = useRouter();
  const [seen, setSeen] = useState(view);
  const [switches, setSwitches] = useState<ContentModuleSwitches>(() => switchesOf(view));
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // A new view from the server replaces the switches held here (React's way to derive state from props while rendering).
  if (seen !== view) {
    setSeen(view);
    setSwitches(switchesOf(view));
  }

  const change = async (module: ContentModuleId, next: boolean) => {
    if (outcome?.status === "pending") return;
    const sent = { ...switches, [module]: next };
    setOutcome({ module, status: "pending" });
    let result: ActionResult<unknown>;
    try {
      result = await save(sent);
    } catch {
      setOutcome({ module, status: "error", problem: everything("errors.INTERNAL") });
      return;
    }
    if (result.ok) {
      setSwitches(sent);
      setOutcome({ module, status: "saved" });
    } else {
      setOutcome({ module, status: "error", problem: failureText(everything, result) });
    }
    router.refresh();
  };

  const rows: ContentModuleRow[] = view.map((item) => {
    const mine = outcome?.module === item.module ? outcome : null;
    return {
      module: item.module,
      live: switches[item.module],
      published: item.published,
      drafts: item.drafts,
      status: mine?.status ?? "idle",
      ...(mine?.problem ? { problem: mine.problem } : {}),
    };
  });

  return { rows, change };
}
