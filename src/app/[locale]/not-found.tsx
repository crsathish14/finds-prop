import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const translate = await getTranslations();
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-16"
    >
      <h1 className="text-2xl font-semibold">{translate("notFound.title")}</h1>
      <p>{translate("notFound.body")}</p>
      <Link href="/" className="underline">
        {translate("common.goHome")}
      </Link>
    </main>
  );
}
