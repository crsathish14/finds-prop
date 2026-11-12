import { IBM_Plex_Sans, IBM_Plex_Serif, Noto_Sans_Tamil } from "next/font/google";

// ADR-127: fonts are self-hosted at build time, so no request goes to Google when a page loads.
// Each font sets a CSS variable on <html>; tokens.css puts them first in --font-display and --font-ui.
// IBM Plex Serif is a static family, so each weight is its own file. 400 is the copper italic emphasis,
// 500 is the heading weight and 600 is the price on detail pages.
const plexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-plex-serif",
});

// IBM Plex Sans is variable (weight 100 to 700), so one file covers every UI weight.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex-sans",
});

// Tamil is not preloaded: it downloads only on a page that shows Tamil text.
const notoSansTamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  display: "swap",
  preload: false,
  variable: "--font-noto-sans-tamil",
});

/** Class names for <html> that define the three font variables. */
export const fontVariables = [plexSerif.variable, plexSans.variable, notoSansTamil.variable].join(
  " ",
);
