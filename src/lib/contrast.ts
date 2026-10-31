/**
 * WCAG 2.2 contrast between two colours (success criteria 1.4.3 and 1.4.11). Used by the Design
 * Lab to show measured ratios, and by a test that checks every text pair in the token file.
 */
type Rgb = { red: number; green: number; blue: number };

/** "#1f4a38", "#fff" or "rgb(31, 74, 56)" (what getComputedStyle returns) as channels 0 to 255. */
export function parseColour(input: string): Rgb | null {
  const text = input.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text);
  if (hex) {
    const digits =
      (hex[1] ?? "").length === 3
        ? [...(hex[1] ?? "")].map((digit) => digit + digit).join("")
        : (hex[1] ?? "");
    return {
      red: Number.parseInt(digits.slice(0, 2), 16),
      green: Number.parseInt(digits.slice(2, 4), 16),
      blue: Number.parseInt(digits.slice(4, 6), 16),
    };
  }
  const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)/.exec(text);
  if (rgb) return { red: Number(rgb[1]), green: Number(rgb[2]), blue: Number(rgb[3]) };
  return null;
}

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(colour: Rgb): number {
  return (
    0.2126 * channel(colour.red) + 0.7152 * channel(colour.green) + 0.0722 * channel(colour.blue)
  );
}

/** 1 (no contrast) to 21 (black on white). Returns null when a colour cannot be read. */
export function contrastRatio(foreground: string, background: string): number | null {
  const first = parseColour(foreground);
  const second = parseColour(background);
  if (!first || !second) return null;
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG level for normal-size text: AAA 7, AA 4.5; large text and UI parts need 3. */
export function wcagLevel(ratio: number): "AAA" | "AA" | "AA large" | "fail" {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA large";
  return "fail";
}
