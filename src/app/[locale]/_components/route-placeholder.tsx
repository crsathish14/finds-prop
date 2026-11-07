import { Text } from "@/components/ui/text";

/**
 * Stands in for a page whose design is not yet approved (S3-T11). It shows the route name for
 * developers and nothing else: no visitor-facing wording is invented. Each page that uses it is
 * replaced by the real page in its own task, so this file goes away with the last of them.
 * `framed` is for a page inside a frame that already provides the page's `<main>` (the admin portal).
 */
export function RoutePlaceholder({ route, framed = false }: { route: string; framed?: boolean }) {
  const text = (
    <Text variant="caption" tone="muted">
      {route}
    </Text>
  );
  if (framed) return <div>{text}</div>;
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-gutter py-14">
      {text}
    </main>
  );
}
