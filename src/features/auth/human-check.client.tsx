"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export type HumanCheckStatus = "checking" | "verified" | "failed";

/** The part of Cloudflare Turnstile's browser API this page uses. */
interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      appearance: "interaction-only";
      size: "flexible";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
    },
  ): string;
  remove(widgetId: string): void;
}

const SCRIPT_ADDRESS = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function turnstileOnPage(): TurnstileApi | undefined {
  return (window as Window & { turnstile?: TurnstileApi }).turnstile;
}

let loading: Promise<TurnstileApi> | undefined;

/** Loads Cloudflare's script once, on the sign-in page only (the one third-party script we allow, plan 05). */
function loadTurnstile(): Promise<TurnstileApi> {
  const ready = turnstileOnPage();
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_ADDRESS;
    script.async = true;
    const fail = () => {
      script.remove();
      loading = undefined;
      reject(new Error("The human check did not load"));
    };
    script.onload = () => {
      const api = turnstileOnPage();
      if (api) resolve(api);
      else fail();
    };
    script.onerror = fail;
    document.head.append(script);
  });
  return loading;
}

type HumanCheckProps = {
  /** NEXT_PUBLIC_TURNSTILE_SITE_KEY. Without one the check cannot pass, so sending stays off. */
  siteKey: string | undefined;
  /** Called whenever the check changes: the token once it has passed, null otherwise. Pass a stable function. */
  onChange: (status: HumanCheckStatus, token: string | null) => void;
  /** "Try again": the parent gives this component a new key, which starts a fresh check. */
  onRetry: () => void;
  /** Only the widget, with no status box: for a screen that shows the outcome in its own words. */
  quiet?: boolean;
};

/**
 * The human check on the phone sign-in form (ADD-01): a status box that says "Checking", "Verified"
 * or "Check failed", with Cloudflare's widget mounted underneath. The widget stays hidden unless a
 * visitor has to do something, so the usual case passes on its own. A token works once, so after
 * each use the parent remounts this component with a new key. Words come from en.json.
 */
export function HumanCheck({ siteKey, onChange, onRetry, quiet = false }: HumanCheckProps) {
  const translate = useTranslations("auth.phone");
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<HumanCheckStatus>(siteKey ? "checking" : "failed");
  const statusText: Record<HumanCheckStatus, string> = {
    checking: translate("check.checking"),
    verified: translate("check.verified"),
    failed: translate("check.failed"),
  };

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    let api: TurnstileApi | undefined;
    let widgetId: string | undefined;
    const fail = () => {
      setStatus("failed");
      onChange("failed", null);
    };
    loadTurnstile().then(
      (turnstile) => {
        if (cancelled || !container.current) return;
        api = turnstile;
        widgetId = turnstile.render(container.current, {
          sitekey: siteKey,
          appearance: "interaction-only",
          size: "flexible",
          callback: (token) => {
            setStatus("verified");
            onChange("verified", token);
          },
          "error-callback": fail,
          "expired-callback": fail,
          "timeout-callback": fail,
        });
      },
      () => {
        if (!cancelled) fail();
      },
    );
    return () => {
      cancelled = true;
      if (widgetId !== undefined) api?.remove(widgetId);
    };
  }, [siteKey, onChange]);

  if (quiet) return <div ref={container} />;

  return (
    <div className="flex flex-col gap-3">
      <div
        role="status"
        aria-busy={status === "checking"}
        className={cn(
          "flex min-h-16 w-full items-center gap-3 rounded-sm border bg-surface px-4 text-small font-semibold text-ink",
          status === "failed" ? "border-danger" : "border-line-strong",
        )}
      >
        {status === "checking" ? (
          <Spinner size="sm" className="text-primary" />
        ) : status === "verified" ? (
          <span className="grid size-6 shrink-0 place-items-center rounded-xs bg-success text-on-primary">
            <Icon icon={Check} size="sm" />
          </span>
        ) : (
          <span className="grid size-6 shrink-0 place-items-center rounded-xs border-2 border-danger text-danger">
            <Icon icon={X} size="sm" />
          </span>
        )}
        <span>{statusText[status]}</span>
        {status === "failed" ? (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onRetry}>
            {translate("tryAgain")}
          </Button>
        ) : (
          <Text as="span" variant="caption" tone="muted" className="ml-auto text-right">
            {translate("check.label")}
          </Text>
        )}
      </div>
      <div ref={container} />
    </div>
  );
}
