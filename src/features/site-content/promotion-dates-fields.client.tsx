"use client";

import { useTranslations } from "next-intl";
import { FormField } from "@/components/patterns/form-field";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { PromotionStatus } from "@/lib/promotion-dates";
import { statusOfTyped, type PromotionDatesValue } from "./promotion-dates-form";

const STATUS_WORDS = {
  scheduled: "status.scheduled",
  running: "status.running",
  ended: "status.ended",
} as const satisfies Record<PromotionStatus, string>;

const STATUS_TONES = {
  scheduled: "info",
  running: "success",
  ended: "neutral",
} as const satisfies Record<PromotionStatus, "info" | "success" | "neutral">;

/** The Scheduled, Running or Ended tag of a promotion (ADR-210). */
export function PromotionStatusTag({ status }: { status: PromotionStatus }) {
  const translate = useTranslations("admin.promotionDates");
  return (
    <Badge dot tone={STATUS_TONES[status]}>
      {translate(STATUS_WORDS[status])}
    </Badge>
  );
}

/** The note that says the days are India dates, shown once on a page that has date boxes. */
export function PromotionDatesNote() {
  const translate = useTranslations("admin.promotionDates");
  return <p className="text-small text-muted">{translate("note")}</p>;
}

export type PromotionDatesFieldsProps = {
  value: PromotionDatesValue;
  onChange: (value: PromotionDatesValue) => void;
  /** Today's India date, from the server, for the tag. */
  today: string;
  disabled?: boolean;
  /** The problems the save found, already in words. */
  errors?: { startsOn?: string | undefined; endsOn?: string | undefined };
  /** Names the promotion for a screen reader when several sets of boxes are on one page ("Starts on, Kadal Homes"). */
  subject?: string;
};

/**
 * A promotion's "Starts on" and "Ends on" boxes with its tag (ADR-210): both optional, India dates. Shared by the
 * Sponsored builders, Top developers and Sponsors pages, and by the moderation pages' Feature.
 */
export function PromotionDatesFields({
  value,
  onChange,
  today,
  disabled = false,
  errors = {},
  subject,
}: PromotionDatesFieldsProps) {
  const translate = useTranslations("admin.promotionDates");
  const named = (label: string) => (subject === undefined ? label : `${label}, ${subject}`);
  return (
    <div className="flex flex-col gap-2" data-slot="promotion-dates">
      <PromotionStatusTag status={statusOfTyped(value, today)} />
      <div className="grid gap-3 md:grid-cols-2">
        <FormField
          label={translate("startsOn")}
          hint={translate("startsHint")}
          {...(errors.startsOn ? { error: errors.startsOn } : {})}
        >
          <Input
            type="date"
            value={value.startsOn}
            disabled={disabled}
            aria-label={named(translate("startsOn"))}
            onChange={(event) => onChange({ ...value, startsOn: event.target.value })}
          />
        </FormField>
        <FormField
          label={translate("endsOn")}
          hint={translate("endsHint")}
          {...(errors.endsOn ? { error: errors.endsOn } : {})}
        >
          <Input
            type="date"
            value={value.endsOn}
            disabled={disabled}
            aria-label={named(translate("endsOn"))}
            onChange={(event) => onChange({ ...value, endsOn: event.target.value })}
          />
        </FormField>
      </div>
    </div>
  );
}
