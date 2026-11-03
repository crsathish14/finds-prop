"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ErrorScreen } from "@/components/layout/error-screen";
import { Button } from "@/components/ui/button";
import { useRequestBottomBar } from "@/lib/bottom-bar-request";

// Shown when a page fails while it renders. Details stay on the server: the digest is a reference
// support can use to find the matching log line, never the error message itself.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const translate = useTranslations();
  // Inside a page group this sits between its header and footer, where the UX shows the bottom bar.
  useRequestBottomBar();
  return (
    <ErrorScreen
      code={translate("errorPage.code")}
      title={translate("errorPage.title")}
      emphasis={translate("errorPage.emphasis")}
      description={translate("errorPage.body")}
      actions={
        <>
          <Button onClick={reset}>{translate("common.tryAgain")}</Button>
          <Button asChild variant="secondary">
            <Link href="/">{translate("common.goHome")}</Link>
          </Button>
        </>
      }
      {...(error.digest
        ? {
            details: {
              summary: translate("common.technicalDetails"),
              text: translate("common.reference", { id: error.digest }),
            },
          }
        : {})}
    />
  );
}
