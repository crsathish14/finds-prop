import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Find Prop", template: "%s · Find Prop" },
  description: "Find homes, plots and new projects in Tamil Nadu.",
};

// Fonts, tokens and the site chrome arrive in Stage 2 (design system).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
