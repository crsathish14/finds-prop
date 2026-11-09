"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SiteContentTab } from "@/components/domain/site-content-layout";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import type { EditableSetting } from "./constants";
import type { Problems } from "./form";

/**
 * What the four Site content pages share (S7-T10, FR-ADM-10): the frame's tabs and words, the save with its toast and
 * its problems, and the alert on top. The pages keep their own values; this holds the rest.
 */

export type SaveContent = (input: Record<string, unknown>) => Promise<ActionResult<unknown>>;

const TABS = ["header", "hero", "homepage", "footer"] as const satisfies readonly EditableSetting[];

/** The four page tabs (links to the four routes, the current one marked) and the words the frame and the save bar need. */
export function useSiteContentFrame(current: EditableSetting) {
  const translate = useTranslations("admin.siteContent");
  const nav = useTranslations("admin.nav");
  const tabs: SiteContentTab[] = TABS.map((key) => ({
    key,
    label: nav(key),
    href: `/admin/${key}`,
    current: key === current,
  }));
  return {
    tabs,
    tabsLabel: nav("siteContent"),
    previewLabel: translate("previewLabel"),
    optional: translate("optional"),
    saveNote: translate("save.note"),
    saveWords: {
      cancel: translate("save.cancel"),
      save: translate("save.save"),
      saving: translate("save.saving"),
    },
  };
}

/** The words of a list of links, shared by the header and the footer. */
export function useLinkListWords() {
  const translate = useTranslations("admin.siteContent.links");
  return {
    row: translate("row"),
    label: translate("label"),
    link: translate("link"),
    add: translate("add"),
    remove: translate("remove"),
    drag: translate("drag"),
    moveUp: translate("moveUp"),
    moveDown: translate("moveDown"),
    empty: translate("empty"),
    full: translate("full"),
  };
}

/**
 * Sends the page's values to its save action. A problem the server pins to a box comes back as words by field path
 * (`links.2.href`) for the page to put on the boxes; any other failure is said in a toast, and the page is read again
 * so it shows what is really saved. After a save the page is read again as well.
 */
export function useSaveFlow(save: SaveContent, saved: { title: string; text: string }) {
  const everything = useTranslations() as unknown as Translator;
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const submit = async (payload: Record<string, unknown>): Promise<Problems> => {
    setSaving(true);
    try {
      const result = await save(payload);
      if (result.ok) {
        notify.success(saved.title, { description: saved.text });
        router.refresh();
        return {};
      }
      const problems: Record<string, string> = {};
      for (const [path, list] of Object.entries(result.fieldErrors ?? {})) {
        const first = list[0];
        if (first && problems[path] === undefined)
          problems[path] = fieldErrorText(everything, first);
      }
      if (Object.keys(problems).length > 0) return problems;
      notify.error(failureText(everything, result));
      router.refresh();
      return {};
    } finally {
      setSaving(false);
    }
  };

  return { saving, submit };
}

/** Brings the alert into view when a save comes back with problems (each answer is a new object, so each one counts). */
export function useScrollToProblems(problems: Problems) {
  const target = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (Object.keys(problems).length > 0) target.current?.scrollIntoView?.({ block: "start" });
  }, [problems]);
  return target;
}
