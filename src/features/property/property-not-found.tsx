import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/layout/container";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { PROPERTIES_PATH } from "./address";

/**
 * "Property not found": a link that matches no approved home (a wrong address, or a home that was sold,
 * rented, withdrawn or is still waiting for review: all look the same to a visitor, by design). One next
 * step: the homes that are available now. It is the page's only heading (h1); the Design Lab, which shows
 * it beside other screens, asks for h2.
 */
export function PropertyNotFound({ titleAs = "h1" }: { titleAs?: "h1" | "h2" }) {
  const translate = useTranslations("property.page.notFound");
  return (
    <Container className="py-10 md:py-14">
      <EmptyState title={translate("title")} description={translate("body")} as={titleAs}>
        <Button asChild variant="primary">
          <Link
            href={PROPERTIES_PATH}
            className="text-on-primary no-underline hover:text-on-primary"
          >
            {translate("browse")}
            <Icon icon={ArrowRight} size="sm" />
          </Link>
        </Button>
      </EmptyState>
    </Container>
  );
}
