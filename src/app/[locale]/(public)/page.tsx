import { getTranslations } from "next-intl/server";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

export default async function HomePage() {
  const translate = await getTranslations("home");
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-gutter py-14"
    >
      <Heading as="h1" size="display">
        {translate("title")}
      </Heading>
      <Text variant="lead">{translate("tagline")}</Text>
    </main>
  );
}
