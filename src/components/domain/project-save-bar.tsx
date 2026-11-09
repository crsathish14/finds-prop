/**
 * ProjectSaveBar: the bar under the project form with what saving does, Cancel and Save project.
 * Purpose: the end of the project form for the admin and the builder (S7-T02, FR-ADM-04, FR-BLD-02). Owner: design
 *   system. It holds no state: the page says whether it is saving and passes the words already translated. Save is
 *   a submit button, so put the bar inside the page's form.
 * Props: note (the line on the left: "Admins can save without re-approval." or what a builder's save does), words
 *   ({ cancel, save, saving }), saving, disabled (nothing to save yet), sticky (default true), onCancel, className.
 * Responsive: the note sits above the buttons on a phone and beside them from 768 px; the bar sticks to the bottom
 *   of the area while the form scrolls.
 * Accessibility: Save says Saving and is marked busy while it works; the note is plain text before the buttons.
 * States: default, saving, nothing to save. Dependencies: Button, cn. Tests: project-form-parts.test.tsx; Design
 *   Lab "Admin" (S7-T02).
 * UX reference: admin-project-form screen (.savebar), builder-project-form screen.
 */
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type ProjectSaveBarProps = {
  note: string;
  words: { cancel: string; save: string; saving: string };
  saving?: boolean;
  disabled?: boolean;
  /** Stick to the bottom of the area while the form scrolls (the default); the Design Lab turns it off. */
  sticky?: boolean;
  onCancel: () => void;
  className?: string;
};

function ProjectSaveBar({
  note,
  words,
  saving = false,
  disabled = false,
  sticky = true,
  onCancel,
  className,
}: ProjectSaveBarProps) {
  return (
    <div
      data-slot="project-save-bar"
      className={cn(
        "z-10 flex flex-col gap-3 border-t border-line bg-surface px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6",
        sticky && "sticky bottom-0",
        className,
      )}
    >
      <p className="text-small text-muted">{note}</p>
      <div className="flex gap-3">
        <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>
          {words.cancel}
        </Button>
        <Button type="submit" variant="primary" loading={saving} disabled={disabled}>
          {saving ? words.saving : words.save}
        </Button>
      </div>
    </div>
  );
}

export { ProjectSaveBar };
export type { ProjectSaveBarProps };
