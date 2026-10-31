/**
 * Logo: the arch mark with the "Find Prop" wordmark (last word in bold).
 * Purpose: the brand lockup for the header, drawer and footer. Owner: design system. Wrap it in a
 *   Link (home) with its own aria-label; Logo itself is not a link.
 * Props: name (the brand name, already-translated, e.g. "Find Prop"; the last word is set bold),
 *   tone ("default" | "on-dark"), className.
 * Responsive: 44 px minimum height so the link around it is a good touch target.
 * Accessibility: the mark is decoration; the name is real text.
 * States: none. Dependencies: ArchMark, cn.
 * Tests: navigation.test.tsx; Design Lab "Foundations" (S2-T07).
 * UX reference: ds-navigation, header (c-nav.css .logo).
 */
import { cn } from "@/lib/cn";
import { ArchMark } from "./arch-mark";

type LogoProps = { name: string; tone?: "default" | "on-dark"; className?: string };

function Logo({ name, tone = "default", className }: LogoProps) {
  const words = name.split(" ");
  const last = words.pop();
  return (
    <span
      data-slot="logo"
      className={cn(
        "inline-flex min-h-(--size-touch-min) shrink-0 items-center gap-2 text-logo",
        tone === "on-dark" ? "text-on-dark" : "text-primary",
        className,
      )}
    >
      <ArchMark tone={tone} />
      <span>
        {words.length > 0 ? `${words.join(" ")} ` : null}
        <b className="font-bold">{last}</b>
      </span>
    </span>
  );
}

export { Logo };
