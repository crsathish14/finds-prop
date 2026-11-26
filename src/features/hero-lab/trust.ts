import { MessageCircle, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Translate } from "@/lib/format";

/** What every experimental hero is given by the hero lab preview. */
export type HeroVariantProps = {
  title: string;
  emphasis?: string | undefined;
  subtitle?: string | undefined;
  /** The site content's small line above the headline (B shows it with a pin). */
  eyebrow?: string | undefined;
  /** The search bar the page uses (AI or keyword), already rendered. */
  search: ReactNode;
  /** The sponsored area in its strip shape, when an ad qualifies for it. */
  strip?: ReactNode;
  /** The sponsored area in its panel shape, when an ad qualifies for it. */
  panel?: ReactNode;
};

export type TrustPoint = {
  key: "approved" | "enquire" | "ai";
  icon: LucideIcon;
  /** The live hero's short line ("Approved listings only"). */
  line: string;
};

/** The three promises of the live Split hero, with the same icons. */
export function trustPoints(translate: Translate): TrustPoint[] {
  return [
    {
      key: "approved",
      icon: ShieldCheck,
      line: translate("home.hero.trust.approved"),
    },
    {
      key: "enquire",
      icon: MessageCircle,
      line: translate("home.hero.trust.enquire"),
    },
    {
      key: "ai",
      icon: Sparkles,
      line: translate("home.hero.trust.ai"),
    },
  ];
}
