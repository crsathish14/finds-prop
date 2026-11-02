import { Text } from "@/components/ui/text";

/**
 * Stands in for a page whose design is not yet approved (S3-T11). It shows the route name for
 * developers and nothing else: no visitor-facing wording is invented. Each page that uses it is
 * replaced by the real page in its own task, so this file goes away with the last of them.
 */
export function RoutePlaceholder({ route }: { route: string }) {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-gutter py-14">
      <Text variant="caption" tone="muted">
        {route}
      </Text>
    </main>
  );
}
