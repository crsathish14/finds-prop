import { HomeSection } from "@/components/domain/home-section";
import { ProjectCard } from "@/components/domain/project-card";
import { PropertyCard } from "@/components/domain/property-card";
import { SectionGrid } from "@/components/domain/section-grid";
import { Heading } from "@/components/ui/heading";
import { CompareCardToggle } from "@/features/compare";
import { toPropertyCard } from "@/features/home";
import { toProjectCard } from "@/features/projects";
import { SaveHomeButton } from "@/features/saved";
import { getSiteSettings, getTranslate } from "@/features/site";
import { publicEnv } from "@/lib/public-env";
import { getAgentListings } from "./queries";

const HOMES_TITLE = "agent-homes-title";
const PROJECTS_TITLE = "agent-projects-title";

/**
 * An agent's newest homes and live projects on their page (owner decision, 26 Nov 2026: everyone sees up to six of each,
 * no list and no paging, so the login wall's lists stay closed). A part with nothing to show is left out whole; with
 * neither, nothing is drawn and no gap is left.
 */
export async function AgentListings({ agentId }: { agentId: string }) {
  const listings = await getAgentListings(agentId);
  if (listings.homes.length === 0 && listings.projects.length === 0) return null;
  const [translate, settings] = await Promise.all([getTranslate(), getSiteSettings()]);
  const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const context = { translate, supabaseUrl };
  return (
    <>
      {listings.homes.length > 0 ? (
        <HomeSection labelledBy={HOMES_TITLE} spacing="tight">
          <Heading as="h2" size="3" id={HOMES_TITLE} className="mb-4">
            {translate("agents.page.homes")}
          </Heading>
          <SectionGrid variant="cards">
            {listings.homes.map((home) => {
              const property = toPropertyCard(home, context);
              return (
                <PropertyCard
                  key={home.short_id}
                  property={property}
                  save={<SaveHomeButton shortId={home.short_id} />}
                  compare={
                    <CompareCardToggle
                      shortId={home.short_id}
                      title={home.title}
                      cover={property.cover?.src ?? null}
                    />
                  }
                />
              );
            })}
          </SectionGrid>
        </HomeSection>
      ) : null}
      {listings.projects.length > 0 ? (
        <HomeSection labelledBy={PROJECTS_TITLE} spacing="tight">
          <Heading as="h2" size="3" id={PROJECTS_TITLE} className="mb-4">
            {translate("agents.page.projects")}
          </Heading>
          <SectionGrid variant="cards">
            {listings.projects.map((project) => (
              <ProjectCard
                key={project.slug}
                project={toProjectCard(project, supabaseUrl, settings.project_prime)}
              />
            ))}
          </SectionGrid>
        </HomeSection>
      ) : null}
    </>
  );
}
