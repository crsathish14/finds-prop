import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ErrorScreen } from "@/components/layout/error-screen";
import { RequestBottomBar } from "@/app/[locale]/_components/request-bottom-bar.client";
import { Button } from "@/components/ui/button";

// Pages that call notFound() show this. A URL that matches no route at all shows
// src/app/global-not-found.tsx instead. Both follow the approved `errors` screen.
export default async function NotFound() {
  const translate = await getTranslations();
  return (
    <>
      <RequestBottomBar />
      <ErrorScreen
        code={translate("notFound.code")}
        title={translate("notFound.title")}
        emphasis={translate("notFound.emphasis")}
        description={translate("notFound.body")}
        actions={
          <Button asChild>
            <Link href="/">{translate("common.goHome")}</Link>
          </Button>
        }
      />
    </>
  );
}
