/**
 * JobClosePosting: the Close posting button of the job editor, and the question it asks first.
 * Purpose: closing a posting takes the job off the site at once, so it asks before it does (ADR-143 section 5). The
 *   job stays in the admin's list as Closed and can be opened again. Owner: design system. It holds no state
 *   beyond what the page passes: the dialog is controlled by the page, which closes it when the action ends.
 * Props: title (the job's title, named in the question), open and onOpenChange (the dialog), onConfirm (what happens
 *   on "Close posting"), loading (the action is running: the confirm button shows it and ignores clicks), disabled (the
 *   job is not open, so there is nothing to close: the button is off and a hint says why), className.
 * Responsive: the button fits its label; the dialog is a centred card up to 480 px wide, buttons stacked on a phone.
 * Accessibility: the button's name is its words; the dialog is an alert dialog that puts focus on Cancel first, so
 *   Enter never closes a posting by accident, and returns focus to the button.
 * States: ready, disabled (with its hint), dialog open, working.
 * Dependencies: Button, ConfirmDialog, Icon, next-intl. Tests: job-parts.test.tsx; Design Lab "Careers" (ADR-143).
 * UX reference: none yet; drawn for the owner's approval.
 */
import { CircleSlash } from "lucide-react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type JobClosePostingProps = {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

function JobClosePosting({
  title,
  open,
  onOpenChange,
  onConfirm,
  loading = false,
  disabled = false,
  className,
}: JobClosePostingProps) {
  const translate = useTranslations();
  return (
    <div data-slot="job-close-posting" className={cn("flex flex-col items-start gap-2", className)}>
      <Button
        type="button"
        variant="danger-outline"
        disabled={disabled}
        iconStart={<Icon icon={CircleSlash} size="sm" />}
        onClick={() => onOpenChange(true)}
      >
        {translate("admin.careers.close.button")}
      </Button>
      {disabled ? (
        <p className="text-small text-muted">{translate("admin.careers.close.notOpen")}</p>
      ) : null}
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        tone="warning"
        icon={<Icon icon={CircleSlash} />}
        title={translate("admin.careers.close.title", { title })}
        description={translate("admin.careers.close.text")}
        confirmLabel={translate("admin.careers.close.confirm")}
        cancelLabel={translate("admin.careers.close.cancel")}
        onConfirm={onConfirm}
        loading={loading}
      />
    </div>
  );
}

export { JobClosePosting };
export type { JobClosePostingProps };
