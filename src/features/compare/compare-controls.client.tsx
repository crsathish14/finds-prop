"use client";

import { Columns2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { CompareToggle } from "@/components/domain/property-card-controls.client";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useCompare } from "./use-compare.client";

type CompareSubject = {
  /** The public id of the home. */
  shortId: string;
  title: string;
  /** The cover picture's address, for the bar; null when the home has none. */
  cover: string | null;
};

/**
 * The Compare checkbox in the foot of a property card, joined to the selection: it adds or removes
 * this home, and switches off (with its reason in the title) when three others are already chosen.
 * Before the page has hydrated the selection is empty, so it first shows "Compare" and is then
 * filled in from what the browser kept.
 */
export function CompareCardToggle({ shortId, title, cover }: CompareSubject) {
  const compare = useCompare();
  const compared = compare.has(shortId);
  return (
    <CompareToggle
      compared={compared}
      disabled={compare.full && !compared}
      onToggle={() =>
        compared ? compare.remove(shortId) : compare.add({ id: shortId, title, cover })
      }
    />
  );
}

/** "Add to compare" in the title block of a property page: the same selection, as a button. */
export function CompareButton({ shortId, title, cover }: CompareSubject) {
  const translate = useTranslations("compare");
  const limit = useTranslations("domain.propertyCard");
  const compare = useCompare();
  const compared = compare.has(shortId);
  const blocked = compare.full && !compared;
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-pressed={compared}
      disabled={blocked}
      title={blocked ? limit("compareLimit") : undefined}
      iconStart={<Icon icon={Columns2} />}
      onClick={() =>
        compared ? compare.remove(shortId) : compare.add({ id: shortId, title, cover })
      }
    >
      {compared ? limit("compared") : translate("add")}
    </Button>
  );
}
