import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/layout/container";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { PROJECTS_PATH } from "./address";

/**
 * "Project not found": a link that matches no approved, published project (a wrong address, or a project
 * that was unpublished, is in review, or belongs to a builder who is no longer active: all look the same
 * to a visitor, by design). One next step: all projects. It is the page's only heading (h1); the Design
 * Lab, which shows it beside other screens, asks for h2.
 */
export function ProjectNotFound({ titleAs = "h1" }: { titleAs?: "h1" | "h2" }) {
  const translate = useTranslations("projects.page.notFound");
  return (
    <Container className="py-10 md:py-14">
      <EmptyState title={translate("title")} description={translate("body")} as={titleAs}>
        <Button asChild variant="primary">
          <Link href={PROJECTS_PATH} className="text-on-primary no-underline hover:text-on-primary">
            {translate("all")}
            <Icon icon={ArrowRight} size="sm" />
          </Link>
        </Button>
      </EmptyState>
    </Container>
  );
}
