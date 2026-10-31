import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const translate = await getTranslations("common");
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-6 py-14"
      aria-busy="true"
    >
      <p role="status">{translate("loading")}</p>
    </main>
  );
}
