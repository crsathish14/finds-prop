/**
 * Logo: the findsprop brand logo, drawn from the brand's own SVG files.
 * Purpose: the brand lockup for the header, drawer, sidebars and footer. Owner: design system. Wrap
 *   it in a Link (home) with its own aria-label; Logo itself is not a link.
 * Props: name (the brand name, already-translated, e.g. "findsprop"; it is the picture's alt text),
 *   tone ("default" for light surfaces | "on-dark" for dark surfaces), variant ("full", the name with the tagline and ".com", the default | "wordmark", the compact
 *   name without them),
 *   className.
 * Responsive: one fixed height (30 px) with the width following the picture; 44 px minimum height so
 *   the link around it is a good touch target.
 * Accessibility: the name is the picture's alt text.
 * States: none. Dependencies: next/image, cn.
 * Tests: navigation.test.tsx; Design Lab "Foundations" (S2-T07).
 * UX reference: ds-navigation, header (c-nav.css .logo).
 */
import Image from "next/image";
import { cn } from "@/lib/cn";

type LogoProps = {
  name: string;
  tone?: "default" | "on-dark";
  variant?: "wordmark" | "full";
  className?: string;
};

// The brand files in public/brand, with the size each one is drawn at (its viewBox).
const LOGO_FILES = {
  wordmark: {
    default: { src: "/brand/findsprop-wordmark.svg", width: 736, height: 168 },
    "on-dark": { src: "/brand/findsprop-wordmark-white.svg", width: 736, height: 168 },
  },
  full: {
    default: { src: "/brand/findsprop-logo.svg", width: 780, height: 168 },
    "on-dark": { src: "/brand/findsprop-logo-white.svg", width: 780, height: 168 },
  },
} as const;

function Logo({ name, tone = "default", variant = "full", className }: LogoProps) {
  const file = LOGO_FILES[variant][tone];
  return (
    <span
      data-slot="logo"
      className={cn(
        "inline-flex min-h-(--size-touch-min) shrink-0 items-center",
        tone === "on-dark" ? "text-on-dark" : "text-primary",
        className,
      )}
    >
      <Image
        src={file.src}
        width={file.width}
        height={file.height}
        alt={name}
        unoptimized
        loading="eager"
        className="h-7.5 w-auto max-w-none"
      />
    </span>
  );
}

export { Logo };
