/**
 * RecentLeads: the newest few people who got in touch, one line each.
 * Purpose: the "Recent leads" box on the admin overview (S7-T06, FR-ADM-01): who, what they asked about and how long
 *   ago, so the admin sees at a glance whether leads are coming in. Owner: design system. It holds no state: the page
 *   passes the lines, already translated and formatted, and puts the box's heading and its "All leads" link around it
 *   (in a ChartCard). It draws only the list.
 * Props: leads ({ id, name, initials, meta (what and where: "Kadal Vista · Enquiry"), when ("12 min ago"), tone
 *   "default" | "copper" (the avatar's colour, which alternates by lead kind) }[]), label (names the list for a screen
 *   reader), empty ({ title, text }, shown when there are no leads), className.
 * Responsive: a name or a line that is too long is cut with an ellipsis and never pushes the time out of the row.
 * Accessibility: a list named by `label`; the avatar is decoration (the initials are hidden from a screen reader) and
 *   the name is text beside it.
 * States: five lines, one line, long names, nothing yet (the empty text).
 * Dependencies: Avatar, cn. Tests: recent-leads.test.tsx; Design Lab "Charts" (S7-T06).
 * UX reference: admin-overview screen, "Recent leads" (recent, avatar sm, who, when).
 */
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

type RecentLead = {
  id: string;
  name: string;
  initials: string;
  meta: string;
  when: string;
  tone?: "default" | "copper";
};

type RecentLeadsProps = {
  leads: RecentLead[];
  label: string;
  empty: { title: string; text: string };
  className?: string;
};

function RecentLeads({ leads, label, empty, className }: RecentLeadsProps) {
  if (leads.length === 0) {
    return (
      <div
        data-slot="recent-leads"
        className={cn("flex flex-col items-center gap-1 px-4 py-8 text-center", className)}
      >
        <p className="text-body font-semibold text-ink">{empty.title}</p>
        <p className="text-small text-muted">{empty.text}</p>
      </div>
    );
  }
  return (
    <ul
      data-slot="recent-leads"
      aria-label={label}
      className={cn("flex min-w-0 flex-col", className)}
    >
      {leads.map((lead) => (
        <li
          key={lead.id}
          className="flex min-w-0 items-center gap-3 border-t border-line py-3 first:border-t-0 first:pt-0"
        >
          <Avatar size="sm" aria-hidden="true">
            <AvatarFallback className={cn(lead.tone === "copper" && "bg-cta-tint text-cta-text")}>
              {lead.initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <b className="truncate text-small font-bold text-ink">{lead.name}</b>
            <span className="truncate text-caption text-muted">{lead.meta}</span>
          </div>
          <span className="flex-none text-caption text-muted">{lead.when}</span>
        </li>
      ))}
    </ul>
  );
}

export { RecentLeads };
export type { RecentLead, RecentLeadsProps };
