import { Briefcase, Building2, ChartColumn, Inbox, Layers, ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/patterns/alert";
import { Badge } from "@/components/ui/badge";
import { Heading } from "@/components/ui/heading";
import { Icon, type LucideIcon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import type { StaffArea, StaffProblem } from "@/types/staff-sign-in";
import { GoogleSignIn } from "./google-sign-in.client";

type StaffSignInScreenProps = { area: StaffArea; problem: StaffProblem | null };

/**
 * The staff sign-in pages (ADD-05 builder and agent, ADD-06 administrator), Google only: one button,
 * no password, no reset and no second step. The shared header and footer are not here: like every page
 * in the route skeleton, they arrive with the shared layout. Words come from en.json.
 */
export function StaffSignInScreen({ area, problem }: StaffSignInScreenProps) {
  return area === "builder" ? (
    <BuilderScreen problem={problem} />
  ) : (
    <AdminScreen problem={problem} />
  );
}

function TitleWithEmphasis({ title, emphasis }: { title: string; emphasis: string }) {
  const at = title.indexOf(emphasis);
  if (at < 0) return title;
  return (
    <>
      {title.slice(0, at)}
      <Heading.Em>{emphasis}</Heading.Em>
      {title.slice(at + emphasis.length)}
    </>
  );
}

function BuilderScreen({ problem }: { problem: StaffProblem | null }) {
  const translate = useTranslations("auth.staff");
  const benefits: { icon: LucideIcon; text: string }[] = [
    { icon: Building2, text: translate("builder.benefitPublish") },
    { icon: Layers, text: translate("builder.benefitUnits") },
    { icon: Inbox, text: translate("builder.benefitLeads") },
    { icon: ChartColumn, text: translate("builder.benefitInsights") },
  ];
  return (
    <main id="main" className="mx-auto w-full max-w-mid flex-1 px-gutter py-10 md:py-14">
      <div className="grid gap-6 lg:grid-cols-2">
        <aside
          aria-label={translate("builder.roleTag")}
          className="hidden flex-col justify-between gap-10 rounded-xl bg-dark p-10 text-on-dark lg:flex"
        >
          <div>
            <Text as="span" variant="overline" tone="inherit" className="text-on-dark-accent">
              {translate("builder.roleTag")}
            </Text>
            <Heading as="h2" size="2" className="mt-3 text-on-dark [&_em]:text-on-dark-accent">
              <TitleWithEmphasis
                title={translate("builder.asideTitle")}
                emphasis={translate("builder.asideEmphasis")}
              />
            </Heading>
          </div>
          <ul className="flex flex-col gap-4">
            {benefits.map((benefit) => (
              <li key={benefit.text} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-pill bg-dark-hover">
                  <Icon icon={benefit.icon} />
                </span>
                <Text as="span" tone="inherit">
                  {benefit.text}
                </Text>
              </li>
            ))}
          </ul>
        </aside>

        <section aria-label={translate("builder.title")} className="grid place-items-center">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-card md:p-8">
            <Badge tone="budget">
              <Icon icon={Briefcase} size="sm" />
              {translate("builder.roleTag")}
            </Badge>
            <Heading as="h1" size="2" className="mt-4">
              {translate("builder.title")}
            </Heading>
            <Text variant="lead" className="mt-2">
              {translate("builder.lead")}
            </Text>
            <div className="mt-6">
              <GoogleSignIn
                area="builder"
                initialProblem={problem}
                denied={{
                  title: translate("builder.deniedTitle"),
                  body: translate("builder.deniedBody"),
                }}
              />
            </div>
            <Alert tone="neutral" className="mt-4">
              {translate("builder.invitationOnly")}
            </Alert>
            <p className="mt-4 text-center">
              <Link href="/auth">{translate("builder.buyerLink")}</Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminScreen({ problem }: { problem: StaffProblem | null }) {
  const translate = useTranslations("auth.staff");
  return (
    <main id="main" className="mx-auto w-full max-w-lg flex-1 px-gutter py-14 md:py-18">
      <div className="rounded-xl border border-line bg-surface p-6 shadow-card md:p-8">
        <Badge tone="budget">
          <Icon icon={Layers} size="sm" />
          {translate("admin.roleTag")}
        </Badge>
        <Heading as="h1" size="2" className="mt-4">
          {translate("admin.title")}
        </Heading>
        <Text variant="lead" className="mt-2">
          {translate("admin.lead")}
        </Text>
        <div className="mt-6">
          <GoogleSignIn
            area="admin"
            initialProblem={problem}
            denied={{
              title: translate("admin.deniedTitle"),
              body: translate("admin.deniedBody"),
            }}
          />
        </div>
        <p className="mt-4 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Icon icon={ArrowLeft} size="sm" />
            {translate("admin.backLink")}
          </Link>
        </p>
      </div>
      <Text variant="caption" tone="muted" className="mt-4 text-center">
        {translate("admin.quietNote")}
      </Text>
    </main>
  );
}
