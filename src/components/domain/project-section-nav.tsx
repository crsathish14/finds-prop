/**
 * ProjectSectionNav: the list of a long form's sections, with where the person is and which sections are done or need work.
 * Purpose: jump around the project form (S7-T02, FR-ADM-04): Basics, Location, RERA, Details, Media, SEO. Owner:
 *   design system. It holds no state: the page says which section is current (it can follow the scroll) and what
 *   state each section is in, and passes the words already translated.
 * Props: sections ({ id, label, state "idle" | "done" | "error" }[]; id is the anchor of the FormSection, and one of
 *   basics, location, rera, details, media, seo picks its icon), current (the id in view), words ({ nav, done,
 *   error }), onSelect (called with the id when a link is chosen; the link still jumps by its anchor), className.
 * Responsive: a row that scrolls sideways on phones and tablets; a column from 1100 px of screen, where the page
 *   keeps it beside the form.
 * Accessibility: a named navigation; the current link has aria-current; the done and error states are said in words
 *   for a screen reader and shown by an icon, not by colour alone.
 * States: nothing done, some done, one with an error, current on each section.
 * Dependencies: Icon, cn. Tests: project-form-parts.test.tsx; Design Lab "Admin" (S7-T02).
 * UX reference: admin-project-form screen (.section-nav).
 */
import {
  BadgeCheck,
  CircleAlert,
  CircleCheck,
  FileText,
  Image,
  MapPin,
  Search,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type ProjectSectionId = "basics" | "location" | "rera" | "details" | "media" | "seo";

type ProjectSectionState = "idle" | "done" | "error";

type ProjectSectionItem = {
  id: ProjectSectionId;
  label: string;
  state: ProjectSectionState;
};

type ProjectSectionNavProps = {
  sections: readonly ProjectSectionItem[];
  current: ProjectSectionId;
  words: { nav: string; done: string; error: string };
  onSelect?: (id: ProjectSectionId) => void;
  className?: string;
};

const ICONS: Record<ProjectSectionId, LucideIcon> = {
  basics: Tag,
  location: MapPin,
  rera: BadgeCheck,
  details: FileText,
  media: Image,
  seo: Search,
};

function ProjectSectionNav({
  sections,
  current,
  words,
  onSelect,
  className,
}: ProjectSectionNavProps) {
  return (
    <nav aria-label={words.nav} data-slot="project-section-nav" className={className}>
      <ul className="flex gap-2 overflow-x-auto pb-2 portal:flex-col portal:overflow-visible portal:pb-0">
        {sections.map((section) => {
          const active = section.id === current;
          return (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect?.(section.id)}
                className={cn(
                  "flex min-h-(--size-chip) items-center gap-2 rounded-pill px-4 text-small font-semibold whitespace-nowrap",
                  "transition-colors duration-(--dur-fast) portal:rounded-md",
                  active ? "bg-primary-tint text-primary" : "text-ink hover:bg-canvas-sunken",
                )}
              >
                <Icon icon={ICONS[section.id]} size="sm" />
                {section.label}
                {section.state === "done" ? (
                  <>
                    <Icon icon={CircleCheck} size="sm" className="text-success" />
                    <span className="sr-only">{` ${words.done}`}</span>
                  </>
                ) : null}
                {section.state === "error" ? (
                  <>
                    <Icon icon={CircleAlert} size="sm" className="text-danger" />
                    <span className="sr-only">{` ${words.error}`}</span>
                  </>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export { ProjectSectionNav };
export type { ProjectSectionId, ProjectSectionItem, ProjectSectionNavProps, ProjectSectionState };
