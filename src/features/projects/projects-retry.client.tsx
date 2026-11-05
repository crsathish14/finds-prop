"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

/** The button itself: busy while the page is being asked for again. */
export function ProjectsRetryView({
  label,
  pending = false,
  onRetry,
}: {
  label: string;
  pending?: boolean;
  onRetry: () => void;
}) {
  return (
    <Button
      variant="danger-outline"
      size="sm"
      loading={pending}
      iconStart={<Icon icon={RefreshCw} size="sm" />}
      onClick={onRetry}
    >
      {label}
    </Button>
  );
}

/**
 * "Try again" for a list that failed to load. The page asks the server for itself again; a failed read
 * is never cached, so this asks the database again. While it waits the button shows it is busy and
 * does nothing a second time.
 */
export function ProjectsRetry({ label }: { label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <ProjectsRetryView
      label={label}
      pending={pending}
      onRetry={() => startTransition(() => router.refresh())}
    />
  );
}
