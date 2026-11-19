"use client";

/**
 * ContentModuleBar: the on/off switch of one content module (Blog, FAQ or Careers) with what it means.
 * Purpose: ADR-143 lets the super admin hide a module from the whole site. This is the one control for it: a switch
 *   with its name, a Live or Hidden label, how many items are published and in draft, and one sentence of what
 *   turning it off does. It is the row of the dashboard's Content modules card (`framed` off) and the bar at the top
 *   of each module's admin page (`framed` on). Owner: design system. It keeps only whether its question is open:
 *   the page sends the change and tells it how that went.
 * Props: module ("blog" | "faq" | "careers"), live (the saved state), published and drafts (counts; a dash when not
 *   given or null, as while the module's table does not exist), status ("idle" default | "pending" | "saved" |
 *   "error"), problem (already-translated reason shown with an error), disabled (another change is being saved),
 *   framed (true default: a bordered bar; false: a plain row), locale ("en" default), onChange(next), className.
 * Responsive: the switch and its words, then the counts beside them from 768 px and under them below that.
 * Accessibility: the switch is named by its visible label ("Show Blog on the site"); Live and Hidden are words with
 *   a dot, never colour alone; the saved line is read politely, an error is an alert; a missing count says "Not
 *   available yet" to a screen reader; turning off asks first in an alert dialog that puts focus on Keep it live.
 * States: live, hidden, pending (the switch is off while saving), saved, error, counts given or missing, the
 *   question open.
 * Dependencies: Switch, Label, Badge, Spinner, Alert, ConfirmDialog, Icon, VisuallyHidden, next-intl.
 * Tests: content-modules.test.tsx; Design Lab "Content module switch bar" (ADR-143).
 * UX reference: none yet; drawn for the owner's approval (the admin overview and module pages, ADR-143 section 5).
 */
import { CircleCheck, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Alert } from "@/components/patterns/alert";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { formatCount } from "@/lib/chart-scale";
import { cn } from "@/lib/cn";

type ContentModuleId = "blog" | "faq" | "careers";
type ContentModuleStatus = "idle" | "pending" | "saved" | "error";

type ContentModuleBarProps = {
  module: ContentModuleId;
  live: boolean;
  published?: number | null | undefined;
  drafts?: number | null | undefined;
  status?: ContentModuleStatus;
  problem?: string;
  disabled?: boolean;
  framed?: boolean;
  locale?: string;
  onChange: (next: boolean) => void;
  className?: string;
};

/** The words of each module (static keys, so the messages check can see them). */
const MODULE_WORDS = {
  blog: { name: "admin.contentModules.blog.name", effect: "admin.contentModules.blog.effect" },
  faq: { name: "admin.contentModules.faq.name", effect: "admin.contentModules.faq.effect" },
  careers: {
    name: "admin.contentModules.careers.name",
    effect: "admin.contentModules.careers.effect",
  },
} as const satisfies Record<ContentModuleId, { name: string; effect: string }>;

function Count({
  label,
  value,
  locale,
  unavailable,
}: {
  label: string;
  value: number | null | undefined;
  locale: string;
  unavailable: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-caption text-muted">{label}</dt>
      <dd className="text-h3 font-semibold text-ink tabular-nums">
        {value === null || value === undefined ? (
          <>
            <span aria-hidden="true">–</span>
            <VisuallyHidden>{unavailable}</VisuallyHidden>
          </>
        ) : (
          formatCount(locale, value)
        )}
      </dd>
    </div>
  );
}

function ContentModuleBar({
  module,
  live,
  published,
  drafts,
  status = "idle",
  problem,
  disabled = false,
  framed = true,
  locale = "en",
  onChange,
  className,
}: ContentModuleBarProps) {
  const translate = useTranslations();
  const switchId = useId();
  const [asking, setAsking] = useState(false);
  const name = translate(MODULE_WORDS[module].name);
  const pending = status === "pending";

  const change = (next: boolean) => {
    // Turning on is safe, so it needs no question; turning off hides a whole section, so it asks first.
    if (next) onChange(true);
    else setAsking(true);
  };

  return (
    <section
      data-slot="content-module-bar"
      data-module={module}
      aria-label={translate("admin.contentModules.barLabel", { name })}
      className={cn(
        "flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between",
        framed && "rounded-xl border border-line bg-surface p-4 md:p-5",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Switch
            id={switchId}
            checked={live}
            disabled={disabled || pending}
            onCheckedChange={change}
          />
          <Label htmlFor={switchId}>
            {translate("admin.contentModules.switchLabel", { name })}
          </Label>
          <Badge dot tone={live ? "success" : "neutral"}>
            {translate(
              live ? "admin.contentModules.status.live" : "admin.contentModules.status.hidden",
            )}
          </Badge>
          {pending ? <Spinner label={translate("admin.contentModules.saving")} /> : null}
        </div>
        <Text variant="caption" tone="muted">
          {translate(MODULE_WORDS[module].effect)}
        </Text>
        <div aria-live="polite">
          {status === "saved" ? (
            <p className="flex items-center gap-2 text-small text-success">
              <Icon icon={CircleCheck} size="sm" />
              {translate(
                live ? "admin.contentModules.saved.live" : "admin.contentModules.saved.hidden",
                {
                  name,
                },
              )}
            </p>
          ) : null}
        </div>
        {status === "error" ? (
          <Alert
            tone="danger"
            title={translate(
              live ? "admin.contentModules.error.turnOff" : "admin.contentModules.error.turnOn",
              { name },
            )}
          >
            {problem ? <p>{problem}</p> : null}
          </Alert>
        ) : null}
      </div>
      <dl className="flex shrink-0 gap-8">
        <Count
          label={translate("admin.contentModules.counts.published")}
          value={published}
          locale={locale}
          unavailable={translate("admin.contentModules.counts.unavailable")}
        />
        <Count
          label={translate("admin.contentModules.counts.drafts")}
          value={drafts}
          locale={locale}
          unavailable={translate("admin.contentModules.counts.unavailable")}
        />
      </dl>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        tone="warning"
        icon={<Icon icon={EyeOff} />}
        title={translate("admin.contentModules.confirm.title", { name })}
        description={translate("admin.contentModules.confirm.text", { name })}
        confirmLabel={translate("admin.contentModules.confirm.confirm", { name })}
        cancelLabel={translate("admin.contentModules.confirm.cancel")}
        onConfirm={() => {
          setAsking(false);
          onChange(false);
        }}
      />
    </section>
  );
}

export { ContentModuleBar };
export type { ContentModuleBarProps, ContentModuleId, ContentModuleStatus };
