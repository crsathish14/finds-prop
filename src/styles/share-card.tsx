import type { CSSProperties } from "react";
import { WORDMARK_LETTERS_PATH, WORDMARK_MARK_PATH, WORDMARK_VIEWBOX } from "./share-card-wordmark";

/**
 * The brand card shown when a page is shared and has no photo of its own (FR-PUB-14, the default
 * Open Graph image): the findsprop wordmark and the tagline on the brand's ink.
 *
 * It lives with the styles because the picture renderer (`next/og`) cannot read CSS variables, so the
 * colours are written out here, and this is the one place a colour may be written out. Each value is a
 * primitive of `tokens.css`, and `share-card.test.ts` fails if one drifts from it. The words arrive as
 * props, from `en.json`, like all visitor-facing text.
 */
export const SHARE_CARD_COLORS = {
  /** `--p-ink-950`, the dark surface of the brand. */
  background: "#0f1a19",
  /** `--p-white`, the wordmark's letters. */
  ink: "#ffffff",
  /** `--p-ink-200`, the quieter line under the name. */
  muted: "#b9c6c4",
  /** `--p-teal-500`, the brand teal that reads on dark; the wordmark's "i" and sparkles. */
  accent: "#16b9a4",
} as const;

const root: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  padding: 96,
  gap: 40,
  backgroundColor: SHARE_CARD_COLORS.background,
};

export function ShareCard({ name, tagline }: { name: string; tagline: string }) {
  return (
    <div style={root}>
      <div style={{ display: "flex" }}>
        <svg width="657" height="150" viewBox={WORDMARK_VIEWBOX} role="img" aria-label={name}>
          <path fillRule="evenodd" fill={SHARE_CARD_COLORS.ink} d={WORDMARK_LETTERS_PATH} />
          <path fillRule="evenodd" fill={SHARE_CARD_COLORS.accent} d={WORDMARK_MARK_PATH} />
        </svg>
      </div>
      {/* A narrower line, so the tagline breaks in two even halves rather than leaving one word alone. */}
      <div
        style={{
          display: "flex",
          maxWidth: 760,
          fontSize: 44,
          lineHeight: 1.3,
          color: SHARE_CARD_COLORS.muted,
        }}
      >
        {tagline}
      </div>
    </div>
  );
}
