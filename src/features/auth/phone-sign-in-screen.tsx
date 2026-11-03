import { Building2, Columns2, Heart, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Heading } from "@/components/ui/heading";
import { Icon, type LucideIcon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { PhoneSignIn } from "./phone-sign-in.client";

type PhoneSignInScreenProps = { siteKey: string | undefined; gate: boolean };

function TitleWithEmphasis({ title, emphasis }: { title: string; emphasis: string }) {
  const at = title.indexOf(emphasis);
  if (at < 0) return title;
  return (
    <>
      {title.slice(0, at)}
      <Heading.Em>{emphasis}</Heading.Em>
      {title.slice(at + emphasis.length)}
    </>
  );
}

/**
 * The customer sign-in page (ADD-01): the panel beside the card is for large screens only, like the
 * staff pages. The shared header and footer are not here: they arrive with the shared layout. Words
 * come from en.json.
 */
export function PhoneSignInScreen({ siteKey, gate }: PhoneSignInScreenProps) {
  const translate = useTranslations("auth.phone");
  const benefits: { icon: LucideIcon; text: string }[] = [
    { icon: Heart, text: translate("benefitShortlist") },
    { icon: Columns2, text: translate("benefitCompare") },
    { icon: MessageCircle, text: translate("benefitEnquire") },
    { icon: Building2, text: translate("benefitPost") },
  ];
  return (
    <main id="main" className="mx-auto w-full max-w-mid flex-1 px-gutter py-10 md:py-14">
      <div className="grid gap-6 lg:grid-cols-2">
        <aside
          aria-label={translate("roleTag")}
          className="hidden flex-col justify-between gap-10 rounded-xl bg-dark p-10 text-on-dark lg:flex"
        >
          <div>
            <Text as="span" variant="overline" tone="inherit" className="text-on-dark-accent">
              {translate("roleTag")}
            </Text>
            <Heading as="h2" size="2" className="mt-3 text-on-dark">
              <TitleWithEmphasis
                title={translate("asideTitle")}
                emphasis={translate("asideEmphasis")}
              />
            </Heading>
          </div>
          <ul className="flex flex-col gap-4">
            {benefits.map((benefit) => (
              <li key={benefit.text} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-pill bg-dark-hover">
                  <Icon icon={benefit.icon} />
                </span>
                <Text as="span" tone="inherit">
                  {benefit.text}
                </Text>
              </li>
            ))}
          </ul>
        </aside>

        <section className="grid place-items-center">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-card md:p-8">
            <PhoneSignIn siteKey={siteKey} gate={gate} />
          </div>
        </section>
      </div>
    </main>
  );
}
