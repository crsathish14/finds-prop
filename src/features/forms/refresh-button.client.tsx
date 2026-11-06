"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

/** "Refresh" on the contact page's notice: asks the server for the page again, with the button working meanwhile. */
export function RefreshButton() {
  const translate = useTranslations("contact.loadFailed");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      loading={pending}
      iconStart={<Icon icon={RefreshCw} />}
      onClick={() => startTransition(() => router.refresh())}
    >
      {translate("refresh")}
    </Button>
  );
}
