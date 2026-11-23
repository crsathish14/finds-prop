import { useTranslations } from "next-intl";
import { ProjectCard } from "@/components/domain/project-card";
import { PropertyCard } from "@/components/domain/property-card";
import { SectionGrid } from "@/components/domain/section-grid";
import { Container } from "@/components/layout/container";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { InlinePhoneSignIn } from "@/features/auth";
import { MOCK_HOMES, MOCK_PROJECTS } from "./mock-data";

export type LoginWallKind = "properties" | "projects" | "compare";

type LoginWallScreenProps = {
  /** Which page the wall stands in for: it decides which made-up cards are drawn behind the message. */
  kind: LoginWallKind;
  /** The site key of the human check the number step uses, as on `/auth` (read by the page from the public environment). */
  siteKey: string | undefined;
};

/**
 * What a visitor who is not signed in sees in place of the list of homes, the list of projects or the
 * comparison (login wall, ADR-171): made-up cards, blurred and hidden from assistive technology, with a message
 * and the phone sign-in itself, number and code, inside the card: nothing navigates, and after the code the
 * page refreshes in place, on the same address with the same filters, and draws the real list. The card is sticky below the header and above the phone bar, so it stays in view while only the made-up cards scroll behind it, and it leaves with them before the footer; where the screen is too short (a phone with the keyboard open) it scrolls inside itself. It fetches nothing, and the made-up
 * cards come from a module that imports nothing from the server, so nothing real can leak through it.
 */
export function LoginWallScreen({ kind, siteKey }: LoginWallScreenProps) {
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
              href: "/",
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
              href: "/",
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
    <Container className="py-6 md:py-8">
      {/* One grid cell holds both layers, so the card's sticky range is the height of the made-up cards: it stays in view
          while they scroll, and leaves with them before the footer. */}
      <div className="grid" data-slot="login-wall-stage">
        <div
          inert
          aria-hidden="true"
          data-slot="login-wall-mock"
          className="pointer-events-none col-start-1 row-start-1 select-none blur-md"
        >
          <SectionGrid variant="cards">{cards}</SectionGrid>
        </div>
        <div
          data-slot="login-wall-sticky"
          className="sticky top-(--wall-card-top) col-start-1 row-start-1 mt-4 self-start md:mt-10"
        >
          <section
            aria-labelledby="login-wall-title"
            data-slot="login-wall-panel"
            className="mx-auto flex max-h-(--wall-card-max-h) max-w-md flex-col items-center gap-4 overflow-y-auto overscroll-contain rounded-md border border-line bg-surface p-6 text-center"
          >
            <Heading as="h1" size="2" id="login-wall-title" tabIndex={-1}>
              {translate("title")}
            </Heading>
            <Text tone="muted">{translate("body")}</Text>
            <div className="w-full text-left" data-slot="login-wall-sign-in">
              <InlinePhoneSignIn siteKey={siteKey} />
            </div>
          </section>
        </div>
      </div>
    </Container>
  );
}
