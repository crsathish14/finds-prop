import { Figtree, Fraunces, Noto_Sans_Tamil } from "next/font/google";

// ADR-005: fonts are self-hosted at build time, so no request goes to Google when a page loads.
// Each font sets a CSS variable on <html>; tokens.css puts them first in --font-display and --font-ui.
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-fraunces",
});

const figtree = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-figtree",
});

// Tamil is not preloaded: it downloads only on a page that shows Tamil text.
const notoSansTamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  display: "swap",
  preload: false,
  variable: "--font-noto-sans-tamil",
});

/** Class names for <html> that define the three font variables. */
export const fontVariables = [fraunces.variable, figtree.variable, notoSansTamil.variable].join(
  " ",
);
