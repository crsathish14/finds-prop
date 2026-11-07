import { getTranslations } from "next-intl/server";
import { Spinner } from "@/components/ui/spinner";

/**
 * A centred spinner that fills the page while it is on its way: the root loading screen, and the
 * stand-in on the sign-in pages while their form is read. It has a height of its own, so the
 * page below the header does not start empty and then jump when the form arrives.
 */
export async function PageLoading() {
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
