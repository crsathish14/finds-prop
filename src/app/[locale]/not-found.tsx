import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-16"
    >
      <h1 className="text-2xl font-semibold">{t("notFound.title")}</h1>
      <p>{t("notFound.body")}</p>
      <Link href="/" className="underline">
        {t("common.goHome")}
      </Link>
    </main>
  );
}
