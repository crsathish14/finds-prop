import { MapPin } from "lucide-react";
import type { CSSProperties } from "react";
import { Container } from "@/components/layout/container";
import { ArchIllustration } from "@/components/ui/arch-illustration";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { getTranslate } from "@/features/site";
import { cn } from "@/lib/cn";
import { LabArches } from "./lab-arches";
import { entranceOrder, HERO_TITLE_ID, layerDepth } from "./layouts";
import { ParallaxStage } from "./parallax-stage.client";
import { trustPoints, type HeroVariantProps } from "./trust";
import { WordReveal } from "./word-reveal";

/** Where each floating card sits under the panel, how deep it is, and when it bobs. */
const FLOATS = [
  { lift: "mb-0", depth: 1.5, bob: "0s" },
  { lift: "mb-8", depth: 2.1, bob: "-2s" },
  { lift: "mb-3", depth: 1.2, bob: "-4s" },
] as const;

/**
 * D, "Layered": an asymmetric split. The headline arrives word by word on the left over teal arcs
 * that draw on and then drift. On the right a stage of layers: a tinted plate at the back, the
 * sponsored panel in the middle, and the three promises as small cards floating in front, each
 * moving by its own depth with the pointer and the scroll (ParallaxStage). The cards hang under the
 * panel and overlap only its frame, so the advertiser's picture and the label stay clear.
 * Without a panel ad the stage shows a doorway drawing; a strip ad then sits under the search.
 * Phones and tablets: one column, no parallax and no loops; the promises are a plain list.
 */
export async function LayeredHero({
  title,
  emphasis,
  subtitle,
  eyebrow,
  search,
  strip,
  panel,
}: HeroVariantProps) {
  const translate = await getTranslate();
  const trust = trustPoints(translate);
  return (
    <section
      data-slot="home-hero"
      data-layout="layered"
      aria-labelledby={HERO_TITLE_ID}
      className="hl-root relative overflow-hidden"
    >
      <ParallaxStage className="relative pt-4 pb-8 md:pt-10 md:pb-10 lg:pt-14 lg:pb-14">
        <div className="hl-layer absolute inset-0" style={layerDepth(0.5)}>
          <LabArches animated />
        </div>
        <Container className="relative">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,var(--w-sponsor-panel))] lg:gap-14">
            <div>
              {eyebrow ? (
                <span
                  className="hl-in mb-4 hidden items-center gap-2 rounded-pill bg-primary-tint px-4 py-2 text-caption font-bold text-primary md:inline-flex"
                  style={entranceOrder(0)}
                >
                  <Icon icon={MapPin} size="sm" />
                  {eyebrow}
                </span>
              ) : null}
              <Heading
                as="h1"
                size="display"
                id={HERO_TITLE_ID}
                className="lg:text-h1 xl:text-display"
              >
                <WordReveal title={title} emphasis={emphasis} />
              </Heading>
              {subtitle ? (
                <p
                  className="hl-in mt-2 text-body text-muted md:mt-3 md:text-lead"
                  style={entranceOrder(4)}
                >
                  {subtitle}
                </p>
              ) : null}
              <div className="hl-in hl-search hl-run mt-5 md:mt-6" style={entranceOrder(5)}>
                {search}
              </div>
              <ul
                className={cn(
                  "hl-in mt-5 flex flex-wrap gap-x-6 gap-y-2 md:mt-6",
                  panel ? "lg:hidden" : undefined,
                )}
                style={entranceOrder(6)}
              >
                {trust.map((point) => (
                  <li
                    key={point.key}
                    className="inline-flex items-center gap-2 text-small font-bold text-primary"
                  >
                    <Icon icon={point.icon} size="sm" />
                    {point.line}
                  </li>
                ))}
              </ul>
              {strip && !panel ? (
                <div className="hl-late mt-8" style={entranceOrder(7)}>
                  {strip}
                </div>
              ) : null}
            </div>

            <div className={cn("relative", panel ? "lg:pb-14" : "hidden lg:block")}>
              {/* The back plate: decoration, the deepest layer. */}
              <div
                aria-hidden="true"
                className="hl-layer absolute top-14 -right-6 bottom-6 left-14 hidden lg:block"
                style={layerDepth(0.3)}
              >
                <div
                  className="hl-pop size-full -rotate-3 rounded-xl bg-primary-tint"
                  style={entranceOrder(1)}
                />
              </div>
              <div className="hl-layer relative" style={layerDepth(0.7)}>
                <div className="hl-pop" style={entranceOrder(2)}>
                  {panel ?? (
                    <div
                      aria-hidden="true"
                      className="grid aspect-[540/510] place-items-center rounded-xl border border-line bg-surface shadow-hover"
                    >
                      <ArchIllustration className="h-48 w-40" />
                    </div>
                  )}
                </div>
              </div>
              {panel ? (
                <ul className="absolute -right-6 bottom-0 -left-14 hidden items-end justify-between gap-3 lg:flex">
                  {trust.map((point, index) => {
                    const float = FLOATS[index] ?? FLOATS[0];
                    return (
                      <li
                        key={point.key}
                        className={cn("hl-layer shrink-0", float.lift)}
                        style={layerDepth(float.depth)}
                      >
                        <div className="hl-pop" style={entranceOrder(6 + index)}>
                          <div
                            className="hl-float flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 shadow-pop"
                            style={{ "--hl-bob-at": float.bob } as CSSProperties}
                          >
                            <span className="grid size-8 shrink-0 place-items-center rounded-pill bg-primary-tint text-primary">
                              <Icon icon={point.icon} size="sm" />
                            </span>
                            <span className="text-caption font-bold whitespace-nowrap text-ink">
                              {point.line}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </div>
        </Container>
      </ParallaxStage>
    </section>
  );
}
