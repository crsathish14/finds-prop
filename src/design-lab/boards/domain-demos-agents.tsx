import { AgentCard, AgentCardSkeleton, type AgentCardData } from "@/components/domain/agent-card";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";

const FULL: AgentCardData = {
  name: "Meena Realty",
  tagline: "Apartments and plots across South Chennai",
  years: 14,
  listings: 23,
  localities: ["Adyar", "Besant Nagar", "Velachery"],
  profileHref: "#agent-1",
};

const BARE: AgentCardData = { name: "Quiet Agent", profileHref: "#agent-2" };

const LONG: AgentCardData = {
  name: "Chidambaram Venkateswaran Property Consultants",
  tagline:
    "A very long line about what this agent does that has to be cut instead of widening the card",
  years: 1,
  listings: 1,
  localities: ["Thiruvanmiyur Extension", "Perungudi", "Sholinganallur", "A fourth, not shown"],
  profileHref: "#agent-3",
};

const contact = (
  <Button type="button" variant="secondary" className="w-full">
    Show contact
  </Button>
);

export function AgentCardDemo() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Text variant="overline">As in the Recommended agents row of the homepage</Text>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <AgentCard agent={FULL} contact={contact} />
          <AgentCard agent={BARE} contact={contact} />
          <AgentCard agent={LONG} contact={contact} />
        </div>
      </div>
      <Specimen label="Loading: the same box, so nothing moves when the data arrives">
        <div className="grid w-full gap-5 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          <AgentCardSkeleton />
          <AgentCardSkeleton />
          <AgentCardSkeleton />
        </div>
      </Specimen>
    </div>
  );
}
