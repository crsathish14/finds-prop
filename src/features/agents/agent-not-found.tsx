import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/layout/container";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";

/** "Agent not found": the page's only heading (h1), with one next step, the homes. */
export function AgentNotFound() {
  const translate = useTranslations("agents.page.notFound");
  return (
    <Container className="py-10 md:py-14">
      <EmptyState title={translate("title")} description={translate("body")} as="h1">
        <Button asChild variant="primary">
          <Link href="/properties" className="text-on-primary no-underline hover:text-on-primary">
            {translate("all")}
            <Icon icon={ArrowRight} size="sm" />
          </Link>
        </Button>
      </EmptyState>
    </Container>
  );
}
