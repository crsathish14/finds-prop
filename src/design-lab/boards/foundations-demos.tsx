"use client";

import {
  Bell,
  Building2,
  Calendar,
  Camera,
  Check,
  ChevronRight,
  Heart,
  House,
  MapPin,
  Menu,
  Phone,
  Search,
  Share2,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/layout/container";
import { ArchIllustration } from "@/components/ui/arch-illustration";
import { ArchMark } from "@/components/ui/arch-mark";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";
import { Price } from "@/components/ui/price";
import { Separator } from "@/components/ui/separator";
import { SkipLink } from "@/components/ui/skip-link";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { contrastRatio, wcagLevel } from "@/lib/contrast";
import { Column, Row, Specimen, Stage } from "../frame";

type Pair = { text: string; ground: string; minimum: number };

const TEXT_PAIRS: Pair[] = [
  { text: "--c-ink", ground: "--c-bg", minimum: 4.5 },
  { text: "--c-muted", ground: "--c-bg", minimum: 4.5 },
  { text: "--c-subtle", ground: "--c-bg", minimum: 4.5 },
  { text: "--c-primary", ground: "--c-bg", minimum: 4.5 },
  { text: "--c-on-primary", ground: "--c-primary", minimum: 4.5 },
  { text: "--c-on-accent", ground: "--c-accent", minimum: 4.5 },
  { text: "--c-accent-text", ground: "--c-bg", minimum: 4.5 },
  { text: "--c-success", ground: "--c-success-bg", minimum: 4.5 },
  { text: "--c-warning", ground: "--c-warning-bg", minimum: 4.5 },
  { text: "--c-danger", ground: "--c-danger-bg", minimum: 4.5 },
  { text: "--c-info", ground: "--c-info-bg", minimum: 4.5 },
  { text: "--c-neutral", ground: "--c-neutral-bg", minimum: 4.5 },
  { text: "--c-on-dark", ground: "--c-dark", minimum: 4.5 },
  { text: "--c-on-dark-muted", ground: "--c-dark", minimum: 4.5 },
  { text: "--c-on-dark-accent", ground: "--c-dark", minimum: 4.5 },
  { text: "--c-border-input", ground: "--c-surface", minimum: 3 },
  { text: "--c-focus", ground: "--c-bg", minimum: 3 },
  { text: "--c-focus-on-dark", ground: "--c-dark", minimum: 3 },
];

/** One pair of colours with the contrast ratio measured in this browser from the live tokens. */
function ContrastRow({ pair }: { pair: Pair }) {
  const sample = useRef<HTMLSpanElement>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  useEffect(() => {
    const element = sample.current;
    if (!element) return;
    const style = getComputedStyle(element);
    setMeasured(contrastRatio(style.color, style.backgroundColor));
  }, []);
  const passes = measured !== null && measured >= pair.minimum;
  return (
    <tr className="border-t border-line">
      <td className="py-2 pr-4">
        {pair.minimum < 4.5 ? (
          // Borders and focus rings are not text, so they are shown as a box, not as letters.
          <span
            ref={sample}
            aria-hidden="true"
            className="inline-block size-10 rounded-sm border-[length:var(--bw-error)]"
            style={{
              color: `var(${pair.text})`,
              backgroundColor: `var(${pair.ground})`,
              borderColor: `var(${pair.text})`,
            }}
          />
        ) : (
          <span
            ref={sample}
            className="inline-block rounded-sm px-3 py-1 text-title-sm"
            style={{ color: `var(${pair.text})`, backgroundColor: `var(${pair.ground})` }}
          >
            Aa
          </span>
        )}
      </td>
      <td className="py-2 pr-4 text-caption text-muted">
        {pair.text} on {pair.ground}
      </td>
      <td className="py-2 pr-4 text-small font-bold tabular-nums" data-testid="contrast-ratio">
        {measured === null ? "…" : `${measured.toFixed(2)} : 1`}
      </td>
      <td className="py-2 text-small font-semibold">
        {measured === null
          ? ""
          : passes
            ? `${wcagLevel(measured)} (needs ${pair.minimum})`
            : `Fails (needs ${pair.minimum})`}
      </td>
    </tr>
  );
}

const SWATCH_GROUPS: { title: string; tokens: string[] }[] = [
  { title: "Surfaces", tokens: ["--c-bg", "--c-bg-sunken", "--c-surface"] },
  {
    title: "Forest (identity, portals)",
    tokens: [
      "--c-primary",
      "--c-primary-hover",
      "--c-primary-deep",
      "--c-primary-tint",
      "--c-primary-tint-2",
    ],
  },
  {
    title: "Copper (the one conversion action)",
    tokens: [
      "--c-accent",
      "--c-accent-hover",
      "--c-accent-text",
      "--c-accent-tint",
      "--c-accent-tint-2",
    ],
  },
  {
    title: "Text and lines",
    tokens: [
      "--c-ink",
      "--c-muted",
      "--c-subtle",
      "--c-border",
      "--c-border-strong",
      "--c-border-input",
    ],
  },
  {
    title: "Status (always with a word and a dot)",
    tokens: [
      "--c-success",
      "--c-success-bg",
      "--c-warning",
      "--c-warning-bg",
      "--c-danger",
      "--c-danger-bg",
      "--c-info",
      "--c-info-bg",
      "--c-neutral",
      "--c-neutral-bg",
    ],
  },
  {
    title: "Dark surfaces",
    tokens: [
      "--c-dark",
      "--c-on-dark",
      "--c-on-dark-muted",
      "--c-on-dark-accent",
      "--c-dark-active",
    ],
  },
  {
    title: "Chart series (fixed order, on white)",
    tokens: ["--c-series-1", "--c-series-2", "--c-series-3", "--c-series-4", "--c-series-other"],
  },
];

export function ColourDemo() {
  return (
    <div className="flex flex-col gap-8">
      {SWATCH_GROUPS.map((group) => (
        <div key={group.title}>
          <Heading as="h3" size="3" className="mb-3">
            {group.title}
          </Heading>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {group.tokens.map((token) => (
              <li key={token} className="flex flex-col gap-2">
                <span
                  className="block h-14 rounded-md border border-line"
                  style={{ backgroundColor: `var(${token})` }}
                />
                <span className="text-caption font-semibold text-ink">{token}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div>
        <Heading as="h3" size="3" className="mb-3">
          Contrast, measured in this browser
        </Heading>
        <table className="w-full max-w-3xl text-left">
          <thead>
            <tr className="text-overline text-muted">
              <th className="pb-2 font-bold">Sample</th>
              <th className="pb-2 font-bold">Pair</th>
              <th className="pb-2 font-bold">Ratio</th>
              <th className="pb-2 font-bold">Result</th>
            </tr>
          </thead>
          <tbody>
            {TEXT_PAIRS.map((pair) => (
              <ContrastRow key={`${pair.text}-${pair.ground}`} pair={pair} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TypographyDemo() {
  return (
    <div className="flex flex-col gap-8">
      <Column className="max-w-none gap-4">
        <Specimen label='Heading size="display" (Fraunces 30 / 46 / 58 by screen)'>
          <Heading as="h3" size="display">
            Find the place that fits your <Heading.Em>life</Heading.Em>
          </Heading>
        </Specimen>
        <Specimen label='Heading size="1"'>
          <Heading as="h3" size="1">
            Homes in Velachery
          </Heading>
        </Specimen>
        <Specimen label='Heading size="2"'>
          <Heading as="h3" size="2">
            Featured homes
          </Heading>
        </Specimen>
        <Specimen label='Heading size="3"'>
          <Heading as="h3" size="3">
            New launches from developers
          </Heading>
        </Specimen>
      </Column>
      <Separator />
      <Column className="max-w-none gap-4">
        {(["body", "small", "caption", "title", "title-sm", "lead", "overline"] as const).map(
          (variant) => (
            <Specimen key={variant} label={`Text variant="${variant}"`}>
              <Text variant={variant}>
                Search, shortlist and compare homes across Chennai and enquire directly.
              </Text>
            </Specimen>
          ),
        )}
        <Specimen label='Text tone="accent" (small copper text uses the AA-safe tone)'>
          <Text variant="small" tone="accent">
            Featured by the owner
          </Text>
        </Specimen>
        <Specimen label="Long text wraps and keeps a readable line length">
          <Text className="max-w-[68ch]">
            Mylapore is one of the oldest neighbourhoods in Chennai, known for its temple, its tank
            and its lanes of old homes. Rents have risen steadily over the last five years, and most
            listings are two and three bedroom apartments within a short walk of the metro station.
          </Text>
        </Specimen>
      </Column>
      <Separator />
      <Row>
        <Specimen label="Price (default)">
          <Price>₹78 L</Price>
        </Specimen>
        <Specimen label='Price size="large"'>
          <Price size="large">₹1.25 Cr</Price>
        </Specimen>
        <Specimen label="Rent">
          <Price>₹48,000/mo</Price>
        </Specimen>
      </Row>
    </div>
  );
}

const SPACING_STEPS = [
  ["--s-1", "1 (4 px)"],
  ["--s-2", "2 (8 px)"],
  ["--s-3", "3 (12 px)"],
  ["--s-4", "4 (16 px)"],
  ["--s-5", "5 (20 px)"],
  ["--s-6", "6 (24 px)"],
  ["--s-8", "8 (32 px)"],
  ["--s-10", "10 (40 px)"],
  ["--s-14", "14 (56 px)"],
  ["--s-18", "18 (72 px)"],
  ["--s-24", "24 (96 px)"],
] as const;

const RADII = [
  ["--r-xs", "xs: tags"],
  ["--r-sm", "sm: small buttons, menu items"],
  ["--r-md", "md: buttons, inputs"],
  ["--r-lg", "lg: grouped fields"],
  ["--r-xl", "xl: cards, dialogs"],
  ["--r-pill", "pill"],
] as const;

const SHADOWS = [
  ["--shadow-card", "card (resting)"],
  ["--shadow-hover", "hover"],
  ["--shadow-float", "float (hero search card only)"],
  ["--shadow-pop", "pop (menus, popovers)"],
  ["--shadow-modal", "modal"],
] as const;

export function SpacingShapeDemo() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Heading as="h3" size="3" className="mb-3">
          Spacing scale (4 px base): the only steps allowed
        </Heading>
        <ul className="flex flex-col gap-2">
          {SPACING_STEPS.map(([token, label]) => (
            <li key={token} className="flex items-center gap-4 text-caption">
              <span className="w-24 shrink-0 font-semibold text-muted">{label}</span>
              <span
                className="block h-3 rounded-xs bg-primary"
                style={{ width: `var(${token})` }}
              />
            </li>
          ))}
        </ul>
      </div>
      <div>
        <Heading as="h3" size="3" className="mb-3">
          Radii
        </Heading>
        <Row>
          {RADII.map(([token, label]) => (
            <Specimen key={token} label={label}>
              <span
                className="block size-20 border-[length:var(--bw-field)] border-primary bg-primary-tint"
                style={{ borderRadius: `var(${token})` }}
              />
            </Specimen>
          ))}
        </Row>
      </div>
      <div>
        <Heading as="h3" size="3" className="mb-3">
          Elevation
        </Heading>
        <Stage tone="canvas">
          <Row>
            {SHADOWS.map(([token, label]) => (
              <Specimen key={token} label={label}>
                <span
                  className="block h-20 w-32 rounded-lg bg-surface"
                  style={{ boxShadow: `var(${token})` }}
                />
              </Specimen>
            ))}
          </Row>
        </Stage>
      </div>
      <div>
        <Heading as="h3" size="3" className="mb-3">
          Border widths
        </Heading>
        <Row>
          {(["--bw-hair", "--bw-field", "--bw-error"] as const).map((token) => (
            <Specimen key={token} label={token}>
              <span
                className="block h-12 w-32 rounded-md border-primary"
                style={{ borderWidth: `var(${token})`, borderStyle: "solid" }}
              />
            </Specimen>
          ))}
        </Row>
      </div>
    </div>
  );
}

export function FocusDemo() {
  return (
    <div className="flex flex-col gap-6">
      <Text>
        Press Tab to see the one focus ring: a 3 px outline offset by 2 px, forest on light surfaces
        and light copper on dark ones. It is an outline, so it survives Windows high contrast.
      </Text>
      <Stage>
        <Row className="items-center">
          <Button>Primary action</Button>
          <Button variant="secondary">Secondary</Button>
          <Input aria-label="Focus sample" placeholder="A field" className="max-w-xs" />
        </Row>
      </Stage>
      <Stage tone="dark">
        <Row className="items-center">
          <Button variant="accent">On a dark surface</Button>
          <a href="#focus" className="text-body font-semibold underline">
            A link on dark
          </a>
        </Row>
      </Stage>
    </div>
  );
}

const ICON_SET = [
  ["Search", Search],
  ["House", House],
  ["Building2", Building2],
  ["MapPin", MapPin],
  ["Heart", Heart],
  ["Share2", Share2],
  ["Bell", Bell],
  ["User", User],
  ["Phone", Phone],
  ["Camera", Camera],
  ["Calendar", Calendar],
  ["Sparkles", Sparkles],
  ["Menu", Menu],
  ["X", X],
  ["Check", Check],
  ["ChevronRight", ChevronRight],
  ["Trash2", Trash2],
] as const;

export function IconsDemo() {
  return (
    <div className="flex flex-col gap-8">
      <Row>
        <Specimen label='Icon size="sm" (16)'>
          <Icon icon={Heart} size="sm" />
        </Specimen>
        <Specimen label='size="md" (20)'>
          <Icon icon={Heart} size="md" />
        </Specimen>
        <Specimen label='size="lg" (24)'>
          <Icon icon={Heart} size="lg" />
        </Specimen>
        <Specimen label="With a label (becomes an image with a name)">
          <Icon icon={Heart} label="Saved homes" />
        </Specimen>
      </Row>
      <ul className="grid grid-cols-3 gap-4 md:grid-cols-6 lg:grid-cols-9">
        {ICON_SET.map(([name, glyph]) => (
          <li key={name} className="flex flex-col items-center gap-2 text-caption text-muted">
            <Icon icon={glyph} size="lg" className="text-primary" />
            {name}
          </li>
        ))}
      </ul>
      <Row className="items-end">
        <Specimen label="ArchMark">
          <ArchMark />
        </Specimen>
        <Specimen label='ArchMark tone="on-dark"'>
          <Stage tone="dark" className="p-3">
            <ArchMark tone="on-dark" />
          </Stage>
        </Specimen>
        <Specimen label="Logo">
          <Logo name="Find Prop" />
        </Specimen>
        <Specimen label='Logo tone="on-dark"'>
          <Stage tone="dark" className="p-3">
            <Logo name="Find Prop" tone="on-dark" />
          </Stage>
        </Specimen>
        <Specimen label="ArchIllustration (empty states)">
          <ArchIllustration />
        </Specimen>
      </Row>
    </div>
  );
}

export function LayoutDemo() {
  return (
    <div className="flex flex-col gap-6">
      <Text>
        Breakpoints: mobile under 768, tablet 768 to 1023, laptop 1024 to 1279, desktop 1280 and up;
        the portal sidebar appears at 1100. Containers use the gutter token (16, 32, 40, 56 px).
      </Text>
      {(["default", "mid", "narrow"] as const).map((size) => (
        <Specimen key={size} label={`Container size="${size}"`} className="w-full">
          <Container size={size} className="w-full bg-primary-tint py-3 text-small">
            Content inside a {size} container
          </Container>
        </Specimen>
      ))}
      <Separator />
      <Row>
        <Specimen label="Separator (horizontal and vertical)">
          <div className="flex h-12 items-center gap-4">
            <span>One</span>
            <Separator orientation="vertical" />
            <span>Two</span>
          </div>
        </Specimen>
        <Specimen label="VisuallyHidden (only screen readers read it)">
          <span>
            Share
            <VisuallyHidden> this property</VisuallyHidden>
          </span>
        </Specimen>
        <Specimen label="SkipLink (hidden until focused: press Tab on a page)">
          <div className="relative h-14 w-64 overflow-hidden rounded-md border border-line">
            <SkipLink href="#layout">Skip to content</SkipLink>
          </div>
        </Specimen>
      </Row>
    </div>
  );
}
