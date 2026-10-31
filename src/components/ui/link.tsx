/**
 * Link: every link on the site.
 * Purpose: one link component over next/link, so styling, external-link safety and the sponsored
 *   rule are the same everywhere. Owner: design system. (When a second language is added, switch
 *   internal links to the language-aware Link from next-intl; see the add-a-language playbook.)
 * Props: variant ("default" underlined | "arrow" with a moving arrow | "nav" | "on-dark"), current
 *   (marks the page the reader is on), external (opens in a new tab with rel="noopener"; then
 *   newTabLabel is required, already-translated, e.g. "(opens in a new tab)"), sponsored (adds
 *   rel="sponsored noopener"; https links only, anything else renders as plain text).
 * Responsive: the arrow variant keeps a 44 px target.
 * Accessibility: visible focus ring; aria-current="page" on the current link; the new-tab notice
 *   is read by screen readers.
 * States: default, hover, focus, current. Dependencies: next/link, cva, cn, Icon.
 * Tests: navigation.test.tsx; Design Lab "Links" (S2-T07).
 * UX reference: ds-components, Links (c-core.css .link, .link-arrow); R-FE-14, R-FE-15.
 */
import { cva, type VariantProps } from "class-variance-authority";
import { ArrowRight } from "lucide-react";
import NextLink from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

const linkStyles = cva("rounded-xs transition-colors duration-(--dur-fast)", {
  variants: {
    variant: {
      default:
        "font-semibold text-primary underline decoration-line-strong decoration-1 underline-offset-4 hover:decoration-primary",
      arrow:
        "group inline-flex min-h-(--size-touch-min) items-center gap-2 text-title-sm text-primary",
      nav: "text-small font-semibold text-ink hover:text-primary aria-[current=page]:text-primary",
      "on-dark":
        "font-semibold text-on-dark underline decoration-dark-line underline-offset-4 hover:decoration-on-dark",
    },
  },
  defaultVariants: { variant: "default" },
});

type LinkProps = Omit<ComponentProps<"a">, "ref" | "href" | "target" | "rel"> &
  VariantProps<typeof linkStyles> & {
    href: string;
    current?: boolean | undefined;
    sponsored?: boolean | undefined;
  } & ({ external?: false; newTabLabel?: never } | { external: true; newTabLabel: string });

function Link({
  href,
  variant,
  current,
  external,
  newTabLabel,
  sponsored = false,
  className,
  children,
  ...props
}: LinkProps) {
  const classes = cn(linkStyles({ variant }), className);
  const body = (
    <>
      {children}
      {variant === "arrow" ? (
        <Icon
          icon={ArrowRight}
          className="transition-transform duration-(--dur-fast) group-hover:translate-x-1"
        />
      ) : null}
    </>
  );
  // R-FE-15: a sponsor link that is not https is shown as text, never as a link.
  if (sponsored && !href.startsWith("https://"))
    return <span className={className}>{children}</span>;

  if (external || sponsored) {
    return (
      // eslint-disable-next-line react/jsx-no-target-blank -- rel is always set below: "noopener", plus "sponsored" for sponsor links (R-FE-14, R-FE-15)
      <a
        href={href}
        target="_blank"
        rel={sponsored ? "sponsored noopener" : "noopener"}
        aria-current={current ? "page" : undefined}
        className={classes}
        {...props}
      >
        {body}
        {newTabLabel ? <span className="sr-only"> {newTabLabel}</span> : null}
      </a>
    );
  }
  return (
    <NextLink
      href={href}
      aria-current={current ? "page" : undefined}
      className={classes}
      // The anchor props are the same ones next/link accepts; exactOptionalPropertyTypes cannot see that.
      {...(props as Omit<ComponentProps<typeof NextLink>, "href">)}
    >
      {body}
    </NextLink>
  );
}

export { Link };
