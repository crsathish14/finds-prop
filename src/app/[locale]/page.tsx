import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const translate = await getTranslations("home");
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-16"
    >
      <h1 className="text-3xl font-semibold">{translate("title")}</h1>
      <p className="text-lg">{translate("tagline")}</p>
    </main>
  );
}
