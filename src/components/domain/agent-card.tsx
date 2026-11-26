/**
 * AgentCard: one recommended agent, as a compact "business card" with their photo, the facts that matter and two ways on.
 * Purpose: the Recommended agents row on the homepage (and anywhere an agent is listed). Owner: design system. It holds no
 *   state and fetches nothing: the page passes the agent's facts, already read, and the contact control.
 * Props: agent (name; photo, a picture address or nothing; tagline; years of experience; listings, the number of live
 *   listings; localities, a few names; profileHref), contact (the control that reveals the phone, a client island the page
 *   builds; left out when there is none), className. A missing photo shows the agent's initials; a missing or zero number,
 *   tagline or locality list is left out whole, never shown blank or as zero. Only the first three localities are shown.
 * Responsive: a fixed-height-free card that fills the width its row gives it (the row makes it 300 px or less on a phone).
 *   The name and tagline are cut with an ellipsis, never allowed to widen the card.
 * Accessibility: the name is a heading that links to the agent's profile; the photo is decoration (its fallback letters are
 *   hidden from screen readers, the name is beside it). The two facts are a description list. Hover lifts the card a little
 *   and deepens its shadow; under prefers-reduced-motion nothing moves.
 * States: default, hover, focus (on the name link and the contact control), photo missing or failed (initials).
 * Dependencies: Avatar, Link, Icon, next-intl, cn.
 * Tests: agent-card.test.tsx; Design Lab "Domain".
 * UX reference: none: a new design (owner request, 26 Nov 2026), built from the Grove tokens.
 */
import { BadgeCheck, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";
import type { Translate } from "@/lib/format";

type AgentCardData = {
  name: string;
  photo?: string | null | undefined;
  tagline?: string | null | undefined;
  years?: number | null | undefined;
  listings?: number | null | undefined;
  localities?: readonly string[] | undefined;
  profileHref: string;
};

type AgentCardProps = {
  agent: AgentCardData;
  contact?: ReactNode;
  className?: string;
};

/** How many localities fit under the facts without the card growing. */
const LOCALITIES_SHOWN = 3;

/** "Meena Realty" becomes "MR"; one word gives one letter. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toUpperCase();
}

function AgentCard({ agent, contact, className }: AgentCardProps) {
  const translate = useTranslations() as unknown as Translate;
  const localities = (agent.localities ?? []).slice(0, LOCALITIES_SHOWN);
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

  return (
    <article
      data-slot="agent-card"
      className={cn(
        "group/agent flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card",
        "transition-[transform,box-shadow,border-color] duration-(--dur) ease-standard",
        "hover:-translate-y-0.5 hover:border-line-strong hover:shadow-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      {/* A tinted band the photo sits across, so the face is the first thing seen. */}
      <div aria-hidden="true" className="h-16 bg-primary-tint" />
      <div className="flex flex-1 flex-col gap-4 px-5 pb-5">
        <div className="-mt-10 flex items-end gap-3">
          <Avatar
            aria-hidden="true"
            className="size-20 border-4 border-surface bg-surface shadow-card"
            data-slot="agent-card-photo"
          >
            {agent.photo ? <AvatarImage src={agent.photo} alt="" /> : null}
            <AvatarFallback className="text-h3" aria-hidden="true">
              {initialsOf(agent.name)}
            </AvatarFallback>
          </Avatar>
          <span className="mb-1 inline-flex items-center gap-1 rounded-pill bg-primary-tint px-2 py-1 text-caption font-semibold text-primary">
            <Icon icon={BadgeCheck} size="sm" />
            {translate("domain.agentCard.badge")}
          </span>
        </div>

        <div className="min-w-0">
          <h3 className="truncate text-title text-ink">
            <Link href={agent.profileHref} className="text-ink no-underline hover:text-primary">
              {agent.name}
            </Link>
          </h3>
          {agent.tagline ? <p className="truncate text-small text-muted">{agent.tagline}</p> : null}
        </div>

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

        {localities.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-caption text-muted">{translate("domain.agentCard.works")}</p>
            <ul className="flex flex-wrap gap-2">
              {localities.map((locality) => (
                <li
                  key={locality}
                  className="inline-flex max-w-full items-center gap-1 rounded-pill border border-line bg-canvas px-3 py-1 text-caption text-ink"
                >
                  <Icon icon={MapPin} size="sm" className="text-primary" />
                  <span className="truncate">{locality}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-auto flex flex-col gap-2 pt-1">
          {contact}
          <Link href={agent.profileHref} variant="arrow">
            {translate("domain.agentCard.viewProfile")}
          </Link>
        </div>
      </div>
    </article>
  );
}

/** The card while its data loads: the same box, so the page does not jump. */
function AgentCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="agent-card-skeleton"
      aria-hidden="true"
      className={cn("h-96 rounded-xl border border-line bg-surface", className)}
    />
  );
}

export { AgentCard, AgentCardSkeleton, initialsOf };
export type { AgentCardData };
