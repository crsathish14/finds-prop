import { z } from "zod";
import { dayNumber, indiaToday } from "@/lib/india-days";

/**
 * The numbers of the admin's Overview page (S7-T06 part 3, FR-ADM-01), as the screen uses them: the one JSON object
 * `admin_overview()` returns (ADR-121), checked with Zod, with the few numbers the page works out itself (the
 * conversion, how long ago each lead came, whether anything happened at all). An object that is not in the expected
 * shape is a failed read, never a half-drawn page.
 */

/** A count from the database: whole and not negative. */
const count = z.number().int().min(0);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const overviewSchema = z.object({
  listings: z.object({ total: count, approved: count, pending: count }),
  people: z.object({ customers: count, agents: count, builders: count }),
  leads: z.object({ leads: count, enquiries: count, shortlists: count, visitors: count }),
  new_today: count,
  sources: z.object({ project_pages: count, property_enquiries: count, other_forms: count }),
  daily: z.array(z.object({ day, leads: count, enquiries: count, shortlists: count })),
  top_projects: z.array(
    z.object({ id: z.string(), slug: z.string(), name: z.string(), enquiries: count }),
  ),
  recent: z.array(
    z.object({
      id: z.string(),
      source: z.enum(["project", "form"]),
      kind: z.enum(["enquiry", "site_visit", "brochure"]).nullable(),
      name: z.string().nullable(),
      label: z.string(),
      created_at: z.string(),
    }),
  ),
});

/** How long ago a lead came, as the list says it: it is turned into words by the page, in the visitor's language. */
export type Ago =
  | { unit: "now" }
  | { unit: "minutes" | "hours" | "days"; count: number }
  | { unit: "yesterday" }
  | { unit: "date"; day: string };

export type LeadKind = "enquiry" | "site_visit" | "brochure";

export interface RecentLeadRow {
  id: string;
  /** A project's lead (with its kind) or a form with no project (no kind). */
  source: "project" | "form";
  kind: LeadKind | null;
  /** Who got in touch; null when the form was sent without a name. */
  name: string | null;
  /** The project's name, or the form's. */
  label: string;
  ago: Ago;
}

export interface Overview {
  listings: { total: number; approved: number; pending: number };
  people: { customers: number; agents: number; builders: number };
  leads: { total: number; enquiries: number; shortlists: number; visitors: number; today: number };
  /** Leads as a percentage of the visitors of project pages, to one decimal; null when nobody visited. */
  conversion: number | null;
  sources: { projectPages: number; propertyEnquiries: number; otherForms: number };
  daily: { day: string; leads: number; enquiries: number; shortlists: number }[];
  topProjects: { id: string; name: string; enquiries: number }[];
  recent: RecentLeadRow[];
  /** Whether anything happened on any day of the range (a lead, an enquiry or a shortlist). */
  active: boolean;
}

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
/** Up to this many days a lead is "3 days ago"; older ones are named by their date. */
const DAYS_AS_WORDS = 30;

/**
 * How long ago a lead came: "just now", minutes, hours, "yesterday", days, then its date. A time that is not a date
 * is its own (empty) date, and one a little in the future (a clock slightly ahead) is "just now", never a negative
 * number.
 */
export function agoOf(createdAt: string, now: Date): Ago {
  const then = Date.parse(createdAt);
  if (Number.isNaN(then)) return { unit: "date", day: "" };
  const minutes = Math.floor(Math.max(0, now.getTime() - then) / MS_PER_MINUTE);
  if (minutes < 1) return { unit: "now" };
  if (minutes < MINUTES_PER_HOUR) return { unit: "minutes", count: minutes };
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return { unit: "hours", count: hours };
  // From a day on, it is the days in India that count, not the hours.
  const thenDay = indiaToday(new Date(then));
  const days = (dayNumber(indiaToday(now)) ?? 0) - (dayNumber(thenDay) ?? 0);
  if (days <= 1) return { unit: "yesterday" };
  if (days <= DAYS_AS_WORDS) return { unit: "days", count: days };
  return { unit: "date", day: thenDay };
}

/** Leads for every hundred visitors of project pages, to one decimal (null when there were no visitors). */
export function conversionOf(leads: number, visitors: number): number | null {
  if (visitors === 0) return null;
  return Math.round((leads / visitors) * 1000) / 10;
}

/** The object from the database as the screen's numbers; an object that is not in the expected shape throws. */
export function toOverview(value: unknown, now: Date): Overview {
  const raw = overviewSchema.parse(value);
  return {
    listings: raw.listings,
    people: raw.people,
    leads: {
      total: raw.leads.leads,
      enquiries: raw.leads.enquiries,
      shortlists: raw.leads.shortlists,
      visitors: raw.leads.visitors,
      today: raw.new_today,
    },
    conversion: conversionOf(raw.leads.leads, raw.leads.visitors),
    sources: {
      projectPages: raw.sources.project_pages,
      propertyEnquiries: raw.sources.property_enquiries,
      otherForms: raw.sources.other_forms,
    },
    daily: raw.daily,
    topProjects: raw.top_projects.map(({ id, name, enquiries }) => ({ id, name, enquiries })),
    recent: raw.recent.map((lead) => ({
      id: lead.id,
      source: lead.source,
      kind: lead.kind,
      name: lead.name,
      label: lead.label,
      ago: agoOf(lead.created_at, now),
    })),
    active: raw.daily.some((entry) => entry.leads + entry.enquiries + entry.shortlists > 0),
  };
}
