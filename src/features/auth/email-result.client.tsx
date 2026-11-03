"use client";

import { Check, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import type { EmailResult } from "@/lib/url/email-result";
import { AuthFrame } from "./auth-frame";
import { EmailStep } from "./email-step.client";
import { goTo } from "./navigate";
import { marker, withLinks } from "./with-links";

type EmailResultProps = {
  result: EmailResult;
  /** The address that was just confirmed, read from the visitor's session. */
  email: string | null;
  /** Whether the visitor still has a session here. An expired link may be opened in another browser. */
  signedIn: boolean;
};

/**
 * Where the email link lands (ADD-03): "Email verified", or "This link has expired or was already
 * used". An expired link may be asked for again only by a signed-in visitor; anyone else is sent to
 * sign in first. Words come from en.json.
 */
export function EmailResultScreen({ result, email, signedIn }: EmailResultProps) {
  const translate = useTranslations("auth.email");
  const [asking, setAsking] = useState(false);
  const verified = result === "verified";

  if (asking) {
    return (
      <AuthFrame step="email">
        <EmailStep redirectTo="/dashboard" />
      </AuthFrame>
    );
  }

  return (
    <AuthFrame step="email">
      <div className="flex flex-col gap-4">
        <span
          className={cn(
            "grid size-12 place-items-center rounded-pill",
            verified ? "bg-success-tint text-success" : "bg-warning-tint text-warning",
          )}
        >
          <Icon icon={verified ? Check : Clock} />
        </span>
        <Heading as="h1" size="2">
          {translate(verified ? "verifiedTitle" : "expiredTitle")}
        </Heading>
        <Text variant="lead">
          {verified
            ? withLinks(translate("verifiedBody", { email: marker("email") }), {
                email: <b>{email}</b>,
              })
            : translate("expiredBody")}
        </Text>
        {verified ? (
          <Button
            variant="accent"
            size="lg"
            className="w-full"
            onClick={() => goTo("/post-property")}
          >
            {translate("continuePost")}
          </Button>
        ) : (
          <Button
            variant="accent"
            size="lg"
            className="w-full"
            onClick={() => (signedIn ? setAsking(true) : goTo("/auth"))}
          >
            {translate("newLink")}
          </Button>
        )}
        <div className="text-center">
          <Button variant="ghost" onClick={() => goTo("/dashboard")}>
            {translate("dashboard")}
          </Button>
        </div>
      </div>
    </AuthFrame>
  );
}
