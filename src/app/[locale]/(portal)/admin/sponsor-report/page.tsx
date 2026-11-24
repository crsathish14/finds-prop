import type { Metadata } from "next";
import { getBuilderOverview } from "@/features/builders";
import { getSponsorAds, getTranslate } from "@/features/site";
import { getSiteContent } from "@/features/site-content";
import {
  getSponsorCounts,
  reportPeriodOf,
  reportRows,
  SponsorReport,
  type ReportSponsors,
} from "@/features/sponsored";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.sponsorReport.metaTitle") };
}

/**
 * The super admin's Sponsor report (ADR-194): views and clicks of each paid placement over the last 7, 30 or 90 days
 * (`?days=`; anything else shows 30). Read as the signed-in admin and never cached; the role gate in the layout has
 * already sent anyone else away, and the database function refuses anyone else too. The sponsors held now come from
 * the site content: the active hero ads and the builders picked on the Sponsored builders page.
 */
export default async function SponsorReportPage({ searchParams }: PageProps) {
  const period = reportPeriodOf((await searchParams).days);
  const [{ settings }, ads, { builders }] = await Promise.all([
    getSiteContent(),
    getSponsorAds(),
    getBuilderOverview(),
  ]);
  const { counts, from, to } = await getSponsorCounts(period);

  const names = new Map<string, string>([
    ...ads.map((ad) => [ad.id, ad.brand?.trim() || ad.alt] as const),
    ...builders.map((builder) => [builder.id, builder.name] as const),
  ]);
  const picked = (ids: readonly string[]) =>
    ids.map((id) => ({ key: id, name: names.get(id) ?? id }));
  const sponsors: ReportSponsors = {
    hero: ads
      .filter((ad) => ad.active)
      .map((ad) => ({ key: ad.id, name: names.get(ad.id) ?? ad.id })),
    results: picked(settings.sponsored_builders.featured),
    spotlight: picked(settings.sponsored_builders.spotlight),
  };
  return (
    <SponsorReport period={period} from={from} to={to} rows={reportRows(counts, sponsors, names)} />
  );
}
