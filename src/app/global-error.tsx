"use client";

import Link from "next/link";
import { ErrorScreen } from "@/components/layout/error-screen";
import { Button } from "@/components/ui/button";
import en from "@/i18n/messages/en.json";
import { cn } from "@/lib/cn";
import { fontVariables } from "@/styles/fonts";
import "@/styles/globals.css";
import { useReportBoundaryError } from "@/lib/use-report-boundary-error";

// Last-resort boundary: it replaces the root layout, so it renders its own html and body. The
// language provider is not available here, so it reads the English file directly.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useReportBoundaryError(error);
  return (
    <html lang="en" className={cn(fontVariables, "h-full antialiased")}>
      <body className="flex min-h-full flex-col">
        <ErrorScreen
          code={en.errorPage.code}
          title={en.errorPage.title}
          emphasis={en.errorPage.emphasis}
          description={en.errorPage.body}
          actions={
            <>
              <Button onClick={reset}>{en.common.tryAgain}</Button>
              <Button asChild variant="secondary">
                <Link href="/">{en.common.goHome}</Link>
              </Button>
            </>
          }
          {...(error.digest
            ? {
                details: {
                  summary: en.common.technicalDetails,
                  text: en.common.reference.replace("{id}", error.digest),
                },
              }
            : {})}
        />
      </body>
    </html>
  );
}
