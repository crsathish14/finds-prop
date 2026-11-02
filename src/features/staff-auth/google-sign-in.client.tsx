"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Alert } from "@/components/patterns/alert";
import { Button } from "@/components/ui/button";
import type { StaffArea, StaffProblem } from "@/types/staff-sign-in";
import { startStaffGoogleSignIn } from "./actions";
import { goTo } from "./navigate";

type Shown = StaffProblem | { problem: "rateLimited"; minutes: number } | null;

type GoogleSignInProps = {
  area: StaffArea;
  /** What the page was sent back with (?denied=1, ?cancelled=1, ?error=1), if anything. */
  initialProblem: StaffProblem | null;
  /** The message for a refused account differs by area, so the screen passes it in. */
  denied: { title: string; body: string };
};

/** How long to say a visitor should wait: the server's answer in whole minutes, at least one. */
function minutesToWait(retryAfter: number | undefined): number {
  return Math.max(1, Math.ceil((retryAfter ?? 600) / 60));
}

/**
 * The only client code on the staff sign-in pages: the Google button and the message above it. It
 * asks the server for the Google address and sends the browser there. It knows nothing about who the
 * visitor is or what they may open: the callback decides that on the server.
 */
export function GoogleSignIn({ area, initialProblem, denied }: GoogleSignInProps) {
  const translate = useTranslations("auth.staff");
  const [shown, setShown] = useState<Shown>(initialProblem);
  const [redirecting, setRedirecting] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = pending || redirecting;
  const rateLimited = typeof shown === "object" && shown !== null;

  function start() {
    setShown(null);
    startTransition(async () => {
      const result = await startStaffGoogleSignIn({ area });
      if (result.ok) {
        // Stay in the busy state until the browser has left the page.
        setRedirecting(true);
        goTo(result.data.url);
        return;
      }
      setShown(
        result.code === "RATE_LIMITED"
          ? { problem: "rateLimited", minutes: minutesToWait(result.retryAfter) }
          : "error",
      );
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {shown === "cancelled" ? (
        <Alert tone="neutral" title={translate("cancelledTitle")}>
          {translate("cancelledBody")}
        </Alert>
      ) : null}
      {shown === "denied" ? (
        <Alert tone="danger" title={denied.title}>
          {denied.body}
        </Alert>
      ) : null}
      {shown === "error" ? (
        <Alert tone="danger" title={translate("errorTitle")}>
          {translate("errorBody")}
        </Alert>
      ) : null}
      {typeof shown === "object" && shown !== null ? (
        <Alert tone="warning" title={translate("rateLimitedTitle")}>
          {translate("rateLimitedBody", { minutes: shown.minutes })}
        </Alert>
      ) : null}
      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        loading={busy}
        disabled={rateLimited}
        onClick={start}
        iconStart={<Image src="/brand/google-g.svg" alt="" width={20} height={20} unoptimized />}
      >
        {busy ? translate("googleOpening") : translate("google")}
      </Button>
    </div>
  );
}
