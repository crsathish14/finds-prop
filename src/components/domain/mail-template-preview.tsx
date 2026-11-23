/**
 * MailTemplatePreview: how one mail reads, with made-up values filled in.
 * Purpose: the preview under the boxes of the admin's mail editor (ADR-183): the subject line and the plain text body
 *   as the person who receives the mail would see them. Owner: design system. It holds no state and fills nothing in
 *   itself: the page fills the template with `renderMailTemplate` and the sample values and passes the result, so the
 *   preview and the real mail can never differ.
 * Props: subject, text (the filled-in mail), fellBack (the wording typed cannot be used, so the standard wording is
 *   shown), words ({ title, subject, body, fellBack } already translated), className.
 * Responsive: full width of its container; long words and links wrap instead of widening it.
 * Accessibility: a named group; the subject and the body are labelled; the body keeps its line breaks as text, never as
 *   markup. The fallback note is plain text with an icon, not colour alone.
 * States: filled, standard wording shown instead (fellBack).
 * Dependencies: Icon, cn. Tests: mail-template-fields.test.tsx; Design Lab "Site content" (ADR-183).
 * UX reference: none: the mail editor has no approved screen (ADR-183). Every word is unapproved.
 */
import { Info } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type MailTemplatePreviewProps = {
  subject: string;
  text: string;
  fellBack?: boolean;
  words: { title: string; subject: string; body: string; fellBack: string };
  className?: string;
};

function MailTemplatePreview({
  subject,
  text,
  fellBack = false,
  words,
  className,
}: MailTemplatePreviewProps) {
  return (
    <div
      role="group"
      aria-label={words.title}
      data-slot="mail-template-preview"
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-canvas-sunken p-4",
        className,
      )}
    >
      <p className="text-caption font-bold text-muted">{words.title}</p>
      {fellBack ? (
        <p className="flex items-start gap-2 text-caption text-muted">
          <Icon icon={Info} size="sm" className="mt-px shrink-0" />
          <span>{words.fellBack}</span>
        </p>
      ) : null}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-caption text-muted">{words.subject}</p>
        <p className="font-bold break-words text-ink">{subject}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-caption text-muted">{words.body}</p>
        <p className="text-small break-words whitespace-pre-line text-ink">{text}</p>
      </div>
    </div>
  );
}

export { MailTemplatePreview };
export type { MailTemplatePreviewProps };
