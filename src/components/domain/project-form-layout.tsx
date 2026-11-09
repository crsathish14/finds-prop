/**
 * ProjectFormLayout: where the parts of the project form sit: the alert on top, the section list, the sections, the
 * admin's side boxes and the save bar.
 * Purpose: one frame for the admin's and the builder's project form (S7-T02, FR-ADM-04, FR-BLD-02). Owner: design
 *   system. It holds nothing: the page puts the parts in its slots.
 * Props: top (the alert about the review rule or the errors, optional), nav (the ProjectSectionNav), aside (the admin's
 *   Enquiry form and Price trends boxes; leave it out for a builder), children (the sections), footer (the
 *   ProjectSaveBar), className.
 * Responsive: one column up to 1100 px of screen, the section list scrolling sideways above the form; from 1100 px the
 *   list sits in a narrow column on the left and stays in view, the sections take the middle and the side boxes the
 *   right when there are any.
 * Accessibility: the order in the page is the reading order: alert, section list, sections, side boxes, save bar.
 * States: admin (with side boxes), builder (without).
 * Dependencies: cn. Tests: project-form-parts.test.tsx; Design Lab "Admin" (S7-T02).
 * UX reference: admin-project-form screen (.pform.with-side), builder-project-form screen.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type ProjectFormLayoutProps = {
  top?: ReactNode;
  nav: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  className?: string;
};

function ProjectFormLayout({
  top,
  nav,
  aside,
  children,
  footer,
  className,
}: ProjectFormLayoutProps) {
  return (
    <div data-slot="project-form-layout" className={cn("flex min-w-0 flex-col gap-4", className)}>
      {top}
      <div className="flex min-w-0 flex-col gap-6 portal:flex-row portal:items-start">
        <div className="min-w-0 portal:sticky portal:top-6 portal:w-48 portal:shrink-0">{nav}</div>
        <div className="min-w-0 flex-1">{children}</div>
        {aside ? (
          <aside className="flex min-w-0 flex-col gap-6 portal:w-80 portal:shrink-0">{aside}</aside>
        ) : null}
      </div>
      {footer}
    </div>
  );
}

export { ProjectFormLayout };
export type { ProjectFormLayoutProps };
