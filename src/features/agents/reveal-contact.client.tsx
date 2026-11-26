"use client";

import { Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import type { ActionResult } from "@/types/action";

/** The reveal action, as the page hands it over (the server action `revealAgentContact`). */
export type RevealContactAction = (input: {
  agentId: string;
}) => Promise<ActionResult<{ phone: string }>>;

type RevealContactProps = {
  agentId: string;
  agentName: string;
  reveal: RevealContactAction;
  /** "secondary" in a card, "primary" on the agent's own page. */
  variant?: "secondary" | "primary";
};

const dialHref = (phone: string) => "tel:" + phone;
const signInHref = (path: string) => "/auth?redirect=" + encodeURIComponent(path);

type Outcome =
  | { kind: "idle" }
  | { kind: "shown"; phone: string }
  | { kind: "sign_in" }
  | { kind: "none" }
  | { kind: "wait" }
  | { kind: "failed" };

/**
 * "Show contact" for one agent. The number is not in the page: pressing the button asks the server, which answers a
 * signed-in visitor with a verified phone and refuses everyone else, who is shown the way to sign in (and back to this
 * page). A shown number is a `tel:` link so a phone dials it. The server decides everything; nothing here says who is asking.
 */
export function RevealContact({
  agentId,
  agentName,
  reveal,
  variant = "secondary",
}: RevealContactProps) {
  const translate = useTranslations();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  const ask = () =>
    startTransition(async () => {
      const result = await reveal({ agentId });
      if (result.ok) return setOutcome({ kind: "shown", phone: result.data.phone });
      if (result.code === "UNAUTHENTICATED" || result.code === "FORBIDDEN") {
        return setOutcome({ kind: "sign_in" });
      }
      if (result.code === "NOT_FOUND") return setOutcome({ kind: "none" });
      if (result.code === "RATE_LIMITED") return setOutcome({ kind: "wait" });
      return setOutcome({ kind: "failed" });
    });

  if (outcome.kind === "shown") {
    return (
      <Button asChild variant={variant} className="w-full">
        <Link
          href={dialHref(outcome.phone)}
          className="text-inherit no-underline hover:text-inherit"
        >
          <Icon icon={Phone} />
          {outcome.phone}
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant={variant}
        className="w-full"
        loading={pending}
        iconStart={<Icon icon={Phone} />}
        aria-label={translate("agents.contact.showFor", { name: agentName })}
        onClick={ask}
      >
        {translate("agents.contact.show")}
      </Button>
      <p role="status" aria-live="polite" className="text-caption text-muted empty:hidden">
        {outcome.kind === "sign_in" ? (
          <>
            {translate("agents.contact.signInNote")}{" "}
            <Link href={signInHref(pathname)}>{translate("agents.contact.signIn")}</Link>
          </>
        ) : outcome.kind === "none" ? (
          translate("agents.contact.none")
        ) : outcome.kind === "wait" ? (
          translate("agents.contact.wait")
        ) : outcome.kind === "failed" ? (
          translate("agents.contact.failed")
        ) : null}
      </p>
    </div>
  );
}
