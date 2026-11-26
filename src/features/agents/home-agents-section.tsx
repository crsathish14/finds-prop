import { AgentCard } from "@/components/domain/agent-card";
import { HomeSection } from "@/components/domain/home-section";
import { ScrollRow } from "@/components/domain/scroll-row";
import { getTranslate } from "@/features/site";
import { publicEnv } from "@/lib/public-env";
import { revealAgentContact } from "./actions";
import { getHomeAgents } from "./queries";
import { RevealContact } from "./reveal-contact.client";
import { toAgentCard } from "./view";

const AGENTS_TITLE = "home-agents-title";

/**
 * "Recommended agents" on the home page: a gliding row of cards, one per active agent with something live (builders
 * are not included), each with the agent's photo, name, years of experience, live listings, a few localities, a
 * "Show contact" button and a link to their page. With no agent to show the section is left out whole, so no gap is
 * left (FR-PUB-05). The agents are read without a cookie, so the section is part of the static shell.
 */
export async function HomeAgentsSection() {
  const agents = await getHomeAgents();
  if (agents.length === 0) return null;
  const translate = await getTranslate();
  return (
    <HomeSection labelledBy={AGENTS_TITLE} spacing="tight">
      <ScrollRow
        id={AGENTS_TITLE}
        title={translate("home.agents.title")}
        description={translate("home.agents.description")}
        label={translate("home.agents.label")}
      >
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={toAgentCard(agent, publicEnv.NEXT_PUBLIC_SUPABASE_URL)}
            contact={
              <RevealContact
                agentId={agent.id}
                agentName={agent.name}
                reveal={revealAgentContact}
              />
            }
          />
        ))}
      </ScrollRow>
    </HomeSection>
  );
}
