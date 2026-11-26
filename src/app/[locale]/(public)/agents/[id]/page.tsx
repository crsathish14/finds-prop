import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  agentPath,
  AgentProfile,
  getAgent,
  isAgentId,
  revealAgentContact,
  RevealContact,
  toAgentCard,
} from "@/features/agents";
import { SEARCH_PATH } from "@/features/search";
import { pageMetadata } from "@/features/seo";
import { getTranslate } from "@/features/site";
import { publicEnv } from "@/lib/public-env";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const translate = await getTranslate();
  const agent = isAgentId(id) ? await getAgent(id.toLowerCase()) : null;
  if (!agent) return { title: translate("agents.page.notFound.title") };
  return pageMetadata({
    title: agent.name,
    description: translate("agents.page.metaFallback", { name: agent.name }),
    path: agentPath(agent.id),
    siteName: translate("meta.title"),
  });
}

/**
 * An agent's own page (owner request, 26 Nov 2026). The address is the agent's id; an id that is no active agent (a
 * builder, an agent switched off, anything else) is "not found". The page holds no phone: "Show contact" asks the server,
 * which answers a signed-in visitor with a verified phone.
 */
export default async function AgentPage({ params }: PageProps) {
  const { id } = await params;
  if (!isAgentId(id)) notFound();
  const agent = await getAgent(id.toLowerCase());
  if (!agent) notFound();
  const translate = await getTranslate();
  return (
    <main id="main" className="flex-1">
      <AgentProfile
        agent={toAgentCard(agent, publicEnv.NEXT_PUBLIC_SUPABASE_URL, new Date().getFullYear())}
        about={agent.description}
        contact={
          <RevealContact
            agentId={agent.id}
            agentName={agent.name}
            reveal={revealAgentContact}
            variant="primary"
          />
        }
        translate={translate}
        homesHref={SEARCH_PATH}
      />
    </main>
  );
}
