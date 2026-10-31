import Link from "next/link";
import { ErrorScreen } from "@/components/layout/error-screen";
import { Button } from "@/components/ui/button";
import en from "@/i18n/messages/en.json";
import { cn } from "@/lib/cn";
import { fontVariables } from "@/styles/fonts";
import "@/styles/globals.css";

// Used when a URL matches no route at all. It bypasses the language layout, so it reads the
// English file directly (like global-error). Pages that call notFound() use [locale]/not-found.tsx.
export default function GlobalNotFound() {
  return (
    <html lang="en" className={cn(fontVariables, "h-full antialiased")}>
      <body className="flex min-h-full flex-col">
        <ErrorScreen
          code={en.notFound.code}
          title={en.notFound.title}
          emphasis={en.notFound.emphasis}
          description={en.notFound.body}
          actions={
            <Button asChild>
              <Link href="/">{en.common.goHome}</Link>
            </Button>
          }
        />
      </body>
    </html>
  );
}
