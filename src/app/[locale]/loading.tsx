import { getTranslations } from "next-intl/server";
import { Spinner } from "@/components/ui/spinner";

export default async function Loading() {
  const translate = await getTranslations("common");
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-gutter py-14 text-primary"
      aria-busy="true"
    >
      <Spinner size="lg" label={translate("loading")} />
    </main>
  );
}
