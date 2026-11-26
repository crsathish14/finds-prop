import { AgentNotFound } from "@/features/agents";

/** "Agent not found": a wrong address, or an id that is no active agent. */
export default function NotFound() {
  return (
    <main id="main" className="flex-1">
      <AgentNotFound />
    </main>
  );
}
