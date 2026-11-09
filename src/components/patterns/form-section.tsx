/**
 * FormSection: one titled block of a long form, with a short line saying what it is for.
 * Purpose: the sections of the project form (Basics, Location, RERA, Details, Media, SEO; S7-T02) so a long form
 *   reads as short parts the section list can jump to. Owner: design system.
 * Props: id (the anchor the section list links to), title, description (optional), children (the boxes), className.
 * Responsive: full width of its container; the padding is smaller on a phone. The anchor leaves room above it so
 *   a jump does not hide the heading under a fixed bar.
 * Accessibility: a labelled region (the heading names it), with the title as a level-2 heading.
 * States: none. Dependencies: cn. Tests: project-form-parts.test.tsx; Design Lab "Admin" (S7-T02).
 * UX reference: admin-project-form screen (.fsec).
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type FormSectionProps = {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

function FormSection({ id, title, description, children, className }: FormSectionProps) {
  const headingId = `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-slot="form-section"
      className={cn(
        "flex scroll-mt-24 flex-col gap-5 rounded-xl border border-line bg-surface p-4 md:p-6",
        className,
      )}
    >
      <header className="flex flex-col gap-1">
        <h2 id={headingId} className="text-title font-bold text-ink">
          {title}
        </h2>
        {description ? <p className="text-small text-muted">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export { FormSection };
export type { FormSectionProps };
