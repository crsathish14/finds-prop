import {
  Bell,
  Building2,
  Columns2,
  Heart,
  Lock,
  Mail,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Heading } from "@/components/ui/heading";
import { Icon, type LucideIcon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

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

export type AuthStep = "phone" | "code" | "email";

/**
 * The panel beside the card on the customer sign-in page, for large screens only: one text for each
 * step (ADD-01 number, ADD-02 code, ADD-03 email). Words come from en.json.
 */

export function AuthAside({ step }: { step: AuthStep }) {
  const translate = useTranslations(
    step === "phone" ? "auth.phone" : step === "code" ? "auth.code" : "auth.email",
  );
  const benefits: { icon: LucideIcon; text: string }[] =
    step === "phone"
      ? [
          { icon: Heart, text: translate("benefitShortlist") },
          { icon: Columns2, text: translate("benefitCompare") },
          { icon: MessageCircle, text: translate("benefitEnquire") },
          { icon: Building2, text: translate("benefitPost") },
        ]
      : step === "code"
        ? [
            { icon: ShieldCheck, text: translate("benefitPrivate") },
            { icon: MessageCircle, text: translate("benefitOwners") },
            { icon: Lock, text: translate("benefitNoPassword") },
          ]
        : [
            { icon: Bell, text: translate("benefitUpdates") },
            { icon: Mail, text: translate("benefitSecond") },
            { icon: Building2, text: translate("benefitPost") },
          ];
  return (
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
  );
}
