import { BadgeCheck, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { initialsOf } from "@/components/domain/agent-card";
import type { AgentCardData } from "@/components/domain/agent-card";
import { Container } from "@/components/layout/container";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import type { Translate } from "@/lib/format";

type AgentProfileProps = {
  agent: AgentCardData;
  about: string | null;
  /** The reveal control, a client island the page builds. */
  contact: ReactNode;
  translate: Translate;
  /** Where "Browse homes" leads. */
  homesHref: string;
};

/**
 * One agent's own page: the photo, name, what the agent says about themselves, the same facts the card shows, every
 * locality they work in and the "Show contact" control. Only what the database function publishes is here, so the phone is
 * never in this page; it arrives when a verified visitor asks. A missing fact is left out whole.
 */
export function AgentProfile({ agent, about, contact, translate, homesHref }: AgentProfileProps) {
  const facts = [
    agent.years
      ? {
          key: "years",
          label: translate("domain.agentCard.experience"),
          value: translate("domain.agentCard.years", { count: agent.years }),
        }
      : null,
    agent.listings
      ? {
          key: "listings",
          label: translate("domain.agentCard.listings"),
          value: String(agent.listings),
        }
      : null,
  ].filter((fact) => fact !== null);
  const localities = agent.localities ?? [];
  return (
    <Container size="mid" className="py-10 md:py-14">
      <div className="grid gap-8 md:grid-cols-3 md:items-start">
        <div className="flex flex-col gap-6 md:col-span-2">
          <div className="flex items-center gap-5">
            <Avatar aria-hidden="true" className="size-24 border-4 border-surface shadow-card">
              {agent.photo ? <AvatarImage src={agent.photo} alt="" /> : null}
              <AvatarFallback className="text-h2" aria-hidden="true">
                {initialsOf(agent.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <span className="mb-2 inline-flex items-center gap-1 rounded-pill bg-primary-tint px-2 py-1 text-caption font-semibold text-primary">
                <Icon icon={BadgeCheck} size="sm" />
                {translate("domain.agentCard.badge")}
              </span>
              <Heading as="h1" size="2">
                {agent.name}
              </Heading>
              {agent.tagline ? <Text tone="muted">{agent.tagline}</Text> : null}
            </div>
          </div>

          {about ? <Text className="whitespace-pre-line">{about}</Text> : null}

          {localities.length > 0 ? (
            <section aria-labelledby="agent-localities" className="flex flex-col gap-3">
              <Heading as="h2" size="3" id="agent-localities">
                {translate("agents.page.localities")}
              </Heading>
              <ul className="flex flex-wrap gap-2">
                {localities.map((locality) => (
                  <li
                    key={locality}
                    className="inline-flex items-center gap-1 rounded-pill border border-line bg-canvas px-3 py-1 text-small text-ink"
                  >
                    <Icon icon={MapPin} size="sm" className="text-primary" />
                    {locality}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-card">
          {facts.length > 0 ? (
            <dl className="grid grid-flow-col auto-cols-fr divide-x divide-line rounded-md border border-line bg-canvas">
              {facts.map((fact) => (
                <div key={fact.key} className="min-w-0 px-3 py-2">
                  <dt className="text-caption text-muted">{fact.label}</dt>
                  <dd className="truncate text-title-sm text-ink">{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {contact}
          <Link href={homesHref} variant="arrow">
            {translate("agents.page.browse")}
          </Link>
        </aside>
      </div>
    </Container>
  );
}
