import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { SectionGrid } from "@/components/domain/section-grid";
import { Container } from "@/components/layout/container";
import { Alert } from "@/components/patterns/alert";
import { Breadcrumb } from "@/components/patterns/breadcrumb";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";
import { Heading, TitleWithEmphasis } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { ProjectsRetry, ProjectsRetryView } from "./projects-retry.client";

const NOTHING = () => undefined;

type ProjectsScreenProps = {
  /** "failed" when the read failed: the alert and Try again are drawn. */
  status: "ok" | "failed";
  /** The project cards, already made by the page. None is the "coming soon" state. */
  cards: readonly ReactNode[];
  /** The region's name, when the site content has one; the heading stays neutral without it. */
  regionName?: string | undefined;
  /** Where "Browse homes" leads when there are no projects. */
  browseHref: string;
  /** Design Lab only: nothing is asked of the server. */
  preview?: boolean;
  /** Design Lab only: several screens on one board need their own heading level and id. */
  titleAs?: "h1" | "h2";
  titleId?: string;
};

/**
 * The projects page below the site header (S4-T09, ADR-046): the breadcrumb, "New launches", the
 * heading ("Projects in {region}", or "New projects" when the site content has no region name) with its
 * line, then the grid of project cards, the "coming soon" state, or the failed state with Try again.
 * It fetches nothing and holds no state, so the Design Lab draws every state with sample projects.
 * The UX's locality chips are marked "proposed" and are not built (DEC-29: only if approved).
 */
export function ProjectsScreen({
  status,
  cards,
  regionName,
  browseHref,
  preview = false,
  titleAs = "h1",
  titleId = "projects-title",
}: ProjectsScreenProps) {
  const translate = useTranslations("projects.list");
  const region = regionName?.trim();
  const title = region ? translate("titleIn", { region }) : translate("title");

  return (
    <Container className="py-6 md:py-8">
      <div className="mb-6 flex flex-col gap-2">
        <Breadcrumb
          navLabel={translate("crumb.nav")}
          backLabel={translate("crumb.backHome")}
          items={[
            { label: translate("crumb.home"), href: "/" },
            { label: translate("crumb.projects") },
          ]}
        />
        <Text as="span" variant="overline" tone="accent">
          {translate("overline")}
        </Text>
        <Heading as={titleAs} size="1" id={titleId} tabIndex={-1}>
          <TitleWithEmphasis title={title} emphasis={region} />
        </Heading>
        <Text tone="muted">{translate("sub")}</Text>
      </div>

      {status === "failed" ? (
        <Alert
          tone="danger"
          title={translate("error.title")}
          action={
            preview ? (
              <ProjectsRetryView label={translate("error.retry")} onRetry={NOTHING} />
            ) : (
              <ProjectsRetry label={translate("error.retry")} />
            )
          }
        >
          {translate("error.body")}
        </Alert>
      ) : cards.length === 0 ? (
        <div role="status" data-slot="projects-empty">
          <EmptyState
            as="h2"
            title={translate("empty.title")}
            description={translate("empty.body")}
          >
            <Button asChild variant="primary">
              <Link
                href={browseHref}
                className="text-on-primary no-underline hover:text-on-primary"
              >
                {translate("empty.browse")}
                <Icon icon={ArrowRight} size="sm" />
              </Link>
            </Button>
          </EmptyState>
        </div>
      ) : (
        <section aria-label={translate("listLabel")}>
          <SectionGrid variant="cards">{cards}</SectionGrid>
        </section>
      )}
    </Container>
  );
}
