"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";
import { SaveButton } from "@/components/domain/property-card-controls.client";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { notify } from "@/lib/notify";
import { ensureSavedLoaded, getSavedSnapshot, subscribeSaved, toggleSaved } from "./saved-state";

/** Where a signed-out visitor is sent to save: sign-in, asked to come back to this page. */
function signInHref(): string {
  const back = `${window.location.pathname}${window.location.search}`;
  return `/auth?gate=save&redirect=${encodeURIComponent(back)}`;
}

/** The saved state of one home, and a tap that changes it and tells the visitor what happened. */
function useSavedHome(shortId: string) {
  const translate = useTranslations("saved");
  const snapshot = useSyncExternalStore(subscribeSaved, getSavedSnapshot, getSavedSnapshot);

  useEffect(() => {
    void ensureSavedLoaded(translate("saved"));
  }, [translate]);

  async function onToggle() {
    const outcome = await toggleSaved(shortId, signInHref());
    if (outcome === "saved") notify.success(translate("saved"));
    if (outcome === "removed") notify.success(translate("removed"));
    if (outcome === "failed") notify.error(translate("failed"));
  }

  return { saved: snapshot.saved.has(shortId), onToggle };
}

/** The heart on a home card (results, homepage, saved homes). */
export function SaveHomeButton({ shortId, className }: { shortId: string; className?: string }) {
  const { saved, onToggle } = useSavedHome(shortId);
  return (
    <SaveButton
      saved={saved}
      onToggle={() => void onToggle()}
      {...(className ? { className } : {})}
    />
  );
}

/** "Save home" in the title block of a property page, beside "Add to compare". */
export function SaveHomeAction({ shortId }: { shortId: string }) {
  const translate = useTranslations("saved");
  const { saved, onToggle } = useSavedHome(shortId);
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-pressed={saved}
      iconStart={<Icon icon={Heart} />}
      onClick={() => void onToggle()}
    >
      {saved ? translate("buttonSaved") : translate("button")}
    </Button>
  );
}
