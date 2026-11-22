import { useTranslations } from "next-intl";
import { ProjectCard } from "@/components/domain/project-card";
import { PropertyCard } from "@/components/domain/property-card";
import { SectionGrid } from "@/components/domain/section-grid";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { MOCK_HOMES, MOCK_PROJECTS } from "./mock-data";

export type LoginWallKind = "properties" | "projects" | "compare";

type LoginWallScreenProps = {
  /** Which page the wall stands in for: it decides which made-up cards are drawn behind the message. */
  kind: LoginWallKind;
  /** The sign-in address with the way back to this page (`/auth?redirect=…`), made by the page. */
  signInHref: string;
};

/**
 * What a visitor who is not signed in sees in place of the list of homes, the list of projects or the
 * comparison (login wall, ADR-171): made-up cards, blurred and hidden from assistive technology, with a message
 * and one button to the phone sign-in. It fetches nothing and holds no state, and it imports no server or
 * database code, so nothing real can leak through it. After sign-in the visitor comes back to the same
 * address and sees the real page.
 */
export function LoginWallScreen({ kind, signInHref }: LoginWallScreenProps) {
  const translate = useTranslations("loginWall");
  const locality = translate("mock.locality");
  const city = translate("mock.city");
  const developer = translate("mock.developer");
  const cards =
    kind === "projects"
      ? MOCK_PROJECTS.map((project, index) => (
          <ProjectCard
            key={index}
            project={{
              href: "/auth",
              name: translate("mock.project", { number: index + 1 }),
              developerName: developer,
              locality: locality,
              city: city,
              priceRupees: project.rupees,
              priceType: "basic",
              offerType: "sale",
              bedrooms: project.bedrooms,
              status: "under_construction",
              cover: { src: project.cover, alt: "" },
            }}
          />
        ))
      : (kind === "compare" ? MOCK_HOMES.slice(0, 2) : MOCK_HOMES).map((home, index) => (
          <PropertyCard
            key={index}
            layout="grid"
            property={{
              href: "/auth",
              title: translate("mock.home", { number: index + 1 }),
              locality: locality,
              city: city,
              rupees: home.rupees,
              listingType: "sale",
              bedrooms: home.bedrooms,
              bathrooms: home.bathrooms,
              areaSqft: home.areaSqft,
              label: null,
              cover: { src: home.cover, alt: "" },
            }}
          />
        ));

  return (
    <Container className="relative py-6 md:py-8">
      <div
        inert
        aria-hidden="true"
        data-slot="login-wall-mock"
        className="pointer-events-none select-none blur-md"
      >
        <SectionGrid variant="cards">{cards}</SectionGrid>
      </div>
      <div className="absolute inset-x-0 top-12 px-gutter">
        <section
          aria-labelledby="login-wall-title"
          data-slot="login-wall-panel"
          className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-md border border-line bg-surface p-6 text-center"
        >
          <Heading as="h1" size="2" id="login-wall-title" tabIndex={-1}>
            {translate("title")}
          </Heading>
          <Text tone="muted">{translate("body")}</Text>
          <Button asChild variant="accent" size="lg" className="w-full">
            <Link href={signInHref} className="text-on-cta no-underline hover:text-on-cta">
              {translate("button")}
            </Link>
          </Button>
        </section>
      </div>
    </Container>
  );
}
