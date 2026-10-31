import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach the class merger our own names, so that cn("text-h2", "text-h1") keeps only the last size
// and cn("text-h1", "text-ink") keeps both (a size and a colour are different things).
const mergeClasses = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "display",
        "h1",
        "h2",
        "h3",
        "body",
        "small",
        "caption",
        "title",
        "title-sm",
        "lead",
        "overline",
        "price",
        "price-lg",
        "logo",
        "stat",
      ],
      radius: ["pill"],
      shadow: ["card", "hover", "float", "pop", "modal"],
    },
  },
});

/** Join class names, drop falsy ones, and let the last of any conflicting Tailwind classes win. */
export function cn(...inputs: ClassValue[]): string {
  return mergeClasses(clsx(inputs));
}
