import { Sparkles } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Heading, TitleWithEmphasis } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { getTranslate } from "@/features/site";
import { entranceOrder, HERO_TITLE_ID } from "./layouts";
import { trustPoints, type HeroVariantProps } from "./trust";

/**
 * C, "Conversational": the search card is the hero. A short prompt and a modest headline lead the
 * eye to a wide, centred search card whose hint types out sample requests (the search bar's
 * `examples`), with suggestion chips sliding in under it. The three promises sit quietly below,
 * and the sponsored strip rises in last as a slim card once the search has settled.
 * Phones: one centred column, a shorter rise; the chips wrap.
 */
export async function ConversationalHero({
  title,
  emphasis,
  subtitle,
  search,
  strip,
  panel,
}: HeroVariantProps) {
  const translate = await getTranslate();
  const sponsor = strip ?? panel;
  return (
    <section
      data-slot="home-hero"
      data-layout="conversational"
      aria-labelledby={HERO_TITLE_ID}
      className="hl-root relative overflow-hidden pt-6 pb-8 md:pt-10 md:pb-10 lg:pt-14"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-3/4 bg-linear-to-b from-primary-tint to-transparent"
      />
      <Container size="mid" className="relative text-center">
        <p
          className="hl-in inline-flex items-center gap-2 rounded-pill border border-primary-tint-2 bg-surface px-4 py-2 text-caption font-bold text-primary"
          style={entranceOrder(0)}
        >
          <Icon icon={Sparkles} size="sm" />
          {translate("heroLab.conversational.prompt")}
        </p>
        <Heading
          as="h1"
          size="1"
          id={HERO_TITLE_ID}
          className="hl-in mx-auto mt-4 max-w-3xl md:mt-5"
          style={entranceOrder(1)}
        >
          <TitleWithEmphasis title={title} emphasis={emphasis} />
        </Heading>
        {subtitle ? (
          <p
            className="hl-in mx-auto mt-2 max-w-210 text-body text-muted md:mt-3 md:text-lead"
            style={entranceOrder(2)}
          >
            {subtitle}
          </p>
        ) : null}
        <div
          className="hl-in hl-search hl-run mx-auto mt-6 max-w-(--w-search-card) text-left md:mt-8"
          style={entranceOrder(3)}
        >
          {search}
        </div>
        <ul
          className="hl-in mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 md:mt-8"
          style={entranceOrder(7)}
        >
          {trustPoints(translate).map((point) => (
            <li
              key={point.key}
              className="inline-flex items-center gap-2 text-small font-bold text-primary"
            >
              <Icon icon={point.icon} size="sm" />
              {point.line}
            </li>
          ))}
        </ul>
        {sponsor ? (
          <div
            className={
              strip
                ? "hl-late mx-auto mt-8 max-w-(--w-sponsor-strip) md:mt-10 md:rounded-xl md:border md:border-line md:bg-surface md:p-4 md:shadow-card"
                : "hl-late mx-auto mt-8 max-w-(--w-sponsor-panel) md:mt-10"
            }
            style={entranceOrder(8)}
          >
            {sponsor}
          </div>
        ) : null}
      </Container>
    </section>
  );
}
