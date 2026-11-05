import type { CSSProperties } from "react";

/**
 * The brand card shown when a page is shared and has no photo of its own (FR-PUB-14, the default
 * Open Graph image): the arch mark, the name and the tagline on the brand's dark green.
 *
 * It lives with the styles because the picture renderer (`next/og`) cannot read CSS variables, so the
 * colours are written out here, and this is the one place a colour may be written out. Each value is a
 * primitive of `tokens.css`, and `share-card.test.ts` fails if one drifts from it. The words arrive as
 * props, from `en.json`, like all visitor-facing text.
 */
export const SHARE_CARD_COLORS = {
  /** `--p-forest-950`, the dark surface of the brand. */
  background: "#163829",
  /** `--p-ivory-50`, the text and the mark's square. */
  ink: "#faf6ee",
  /** `--p-mist-300`, the quieter line under the name. */
  muted: "#b9cbc0",
  /** `--p-copper-400`, the copper that reads on dark; the last word of the name. */
  accent: "#e8b98f",
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
  const words = name.split(" ");
  const last = words.pop() ?? name;
  return (
    <div style={root}>
      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        <svg width="136" height="136" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="9" fill={SHARE_CARD_COLORS.ink} />
          <path
            d="M10 24v-8.5a6 6 0 0 1 12 0V24"
            fill="none"
            stroke={SHARE_CARD_COLORS.background}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <circle cx="16" cy="19.2" r="2.1" fill={SHARE_CARD_COLORS.background} />
        </svg>
        <div
          style={{ display: "flex", fontSize: 120, lineHeight: 1, color: SHARE_CARD_COLORS.ink }}
        >
          {words.length > 0 ? `${words.join(" ")} ` : null}
          <span style={{ color: SHARE_CARD_COLORS.accent }}>{last}</span>
        </div>
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
