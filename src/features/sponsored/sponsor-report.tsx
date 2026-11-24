import { useLocale, useTranslations } from "next-intl";
import NextLink from "next/link";
import { ResponsiveTable } from "@/components/patterns/responsive-table";
import { Badge } from "@/components/ui/badge";
import { Heading } from "@/components/ui/heading";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { SPONSOR_EVENT_SLOTS, type SponsorEventSlot } from "@/lib/sponsor-events";
import { clickRate, REPORT_PERIODS, type ReportPeriod, type ReportRow } from "./report";

/** Where the report lives; the period is in the address (`?days=30`). */
export const SPONSOR_REPORT_PATH = "/admin/sponsor-report";

type SponsorReportProps = {
  period: ReportPeriod;
  from: string;
  to: string;
  rows: Record<SponsorEventSlot, ReportRow[]>;
};

/** The words of each placement (written out, so the message check can see them). */
const SLOT_WORDS = {
  hero: { title: "slots.hero.title", text: "slots.hero.text" },
  results: { title: "slots.results.title", text: "slots.results.text" },
  spotlight: { title: "slots.spotlight.title", text: "slots.spotlight.text" },
} as const satisfies Record<SponsorEventSlot, { title: string; text: string }>;

const PERIOD_LINK =
  "inline-flex h-(--size-btn-sm) items-center rounded-pill border px-4 text-small font-semibold transition-colors duration-(--dur-fast)";

/** A day kept as `YYYY-MM-DD` (India time), written for people. */
const dayOf = (locale: string, day: string) => formatDate(locale, `${day}T12:00:00+05:30`);

/**
 * The super admin's Sponsor report (ADR-194): for each paid placement (the hero ads, the Featured project card, the
 * Developer spotlight), how many people saw and clicked each sponsor over the period picked, and the click rate.
 * Every sponsor shown now has a row, with zeros until it is counted; a sponsor no longer shown that was counted in the
 * period follows, marked so. It holds no state: the page reads the counts and the names.
 */
export function SponsorReport({ period, from, to, rows }: SponsorReportProps) {
  const translate = useTranslations("admin.sponsorReport");
  const locale = useLocale();
  const number = new Intl.NumberFormat(locale);
  const columns = [
    { id: "sponsor", heading: translate("columns.sponsor"), role: "main" as const, width: 46 },
    { id: "views", heading: translate("columns.views"), align: "end" as const, nowrap: true },
    { id: "clicks", heading: translate("columns.clicks"), align: "end" as const, nowrap: true },
    { id: "rate", heading: translate("columns.rate"), align: "end" as const, nowrap: true },
  ];

  return (
    <div data-slot="sponsor-report" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading as="h1" size="2">
          {translate("title")}
        </Heading>
        <p className="text-body text-muted">{translate("description")}</p>
      </div>
      <div className="flex flex-col gap-2">
        <nav aria-label={translate("period")} className="flex flex-wrap gap-2">
          {REPORT_PERIODS.map((days) => (
            <NextLink
              key={days}
              href={{ pathname: SPONSOR_REPORT_PATH, query: { days } }}
              aria-current={days === period ? "page" : undefined}
              className={cn(
                PERIOD_LINK,
                days === period
                  ? "border-primary bg-primary text-on-primary"
                  : "border-line-strong bg-surface text-ink hover:border-primary hover:text-primary",
              )}
            >
              {translate("days", { count: days })}
            </NextLink>
          ))}
        </nav>
        <p className="text-small text-muted">
          {translate("range", { from: dayOf(locale, from), to: dayOf(locale, to) })}
        </p>
      </div>
      {SPONSOR_EVENT_SLOTS.map((slot) => {
        const list = rows[slot];
        const titleId = `sponsor-report-${slot}`;
        return (
          <section key={slot} aria-labelledby={titleId} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Heading as="h2" size="3" id={titleId}>
                {translate(SLOT_WORDS[slot].title)}
              </Heading>
              <p className="text-small text-muted">{translate(SLOT_WORDS[slot].text)}</p>
            </div>
            {list.length > 0 ? (
              <ResponsiveTable
                caption={translate(SLOT_WORDS[slot].title)}
                columns={columns}
                rows={list.map((row) => {
                  const rate = clickRate(row.views, row.clicks);
                  return {
                    id: row.key,
                    cells: {
                      sponsor: (
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink">
                            {row.name ?? translate("removed")}
                          </span>
                          {row.live ? null : <Badge>{translate("notShown")}</Badge>}
                        </span>
                      ),
                      views: <span className="tabular-nums">{number.format(row.views)}</span>,
                      clicks: <span className="tabular-nums">{number.format(row.clicks)}</span>,
                      rate: (
                        <span className="tabular-nums">
                          {rate === null ? translate("noRate") : translate("rate", { rate })}
                        </span>
                      ),
                    },
                  };
                })}
              />
            ) : (
              <p className="rounded-lg border border-dashed border-line-strong p-4 text-small text-muted">
                {translate("empty")}
              </p>
            )}
          </section>
        );
      })}
      <p className="text-small text-muted">{translate("note")}</p>
    </div>
  );
}
