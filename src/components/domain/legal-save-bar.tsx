/**
 * LegalSaveBar: the bar under the legal editor: what saving does, Discard, Save draft and Publish.
 * Purpose: the end of the Privacy Policy and Terms of Use editor (ADR-151, part C). Owner: design system. It holds no
 *   state: the page says whether it is saving and passes the words, already translated. Save draft is the form's submit
 *   button (so Enter in a box saves a draft, never publishes); Publish is its own button that the page answers.
 * Props: note (the line on the left: what the two buttons do), words ({ discard, saveDraft, publish, saving }), saving,
 *   disabled (nothing to save yet), sticky (default true), onDiscard, onPublish, className.
 * Responsive: the note sits above the buttons on a phone and beside them from 768 px; the buttons wrap instead of
 *   widening the bar; the bar sticks to the bottom of the area while the form scrolls.
 * Accessibility: while saving, both Save draft and Publish are off and the busy one says "Saving", so a repeated press
 *   cannot raise the version twice; the note is plain text before the buttons.
 * States: default, saving a draft, publishing, nothing to save.
 * Dependencies: Button, cn. Tests: legal-save-bar.test.tsx; Design Lab "Site content" (ADR-151).
 * UX reference: none: the legal editor has no approved screen (ADR-151); it follows the Site content save bar. Every
 *   word is unapproved.
 */
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type LegalSaveBarProps = {
  note: string;
  words: { discard: string; saveDraft: string; publish: string; saving: string };
  /** Which button is working, or null when nothing is. */
  saving?: "draft" | "publish" | null;
  disabled?: boolean;
  sticky?: boolean;
  onDiscard: () => void;
  onPublish: () => void;
  className?: string;
};

function LegalSaveBar({
  note,
  words,
  saving = null,
  disabled = false,
  sticky = true,
  onDiscard,
  onPublish,
  className,
}: LegalSaveBarProps) {
  const busy = saving !== null;
  return (
    <div
      data-slot="legal-save-bar"
      className={cn(
        "z-10 flex flex-col gap-3 border-t border-line bg-surface px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6",
        sticky && "sticky bottom-0",
        className,
      )}
    >
      <p className="text-small text-muted">{note}</p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" disabled={busy} onClick={onDiscard}>
          {words.discard}
        </Button>
        <Button
          type="submit"
          variant="secondary"
          loading={saving === "draft"}
          disabled={disabled || (busy && saving !== "draft")}
        >
          {saving === "draft" ? words.saving : words.saveDraft}
        </Button>
        <Button
          type="button"
          variant="primary"
          loading={saving === "publish"}
          disabled={disabled || (busy && saving !== "publish")}
          onClick={onPublish}
        >
          {saving === "publish" ? words.saving : words.publish}
        </Button>
      </div>
    </div>
  );
}

export { LegalSaveBar };
export type { LegalSaveBarProps };
