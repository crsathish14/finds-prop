import { MessageCircle, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";
import type { ContactLinks } from "./view";

/**
 * What a phone has under a project's details (below 1024 px, UX: the bar with Call, WhatsApp and
 * "Enquire about this project"): Call and WhatsApp as round icon buttons (each only when the project
 * has a number that allows it) and one copper button that leads to the enquiry card (`#enquiry`) lower
 * on the page. It is pinned to the bottom of the screen and leaves room for the phone's home bar; from
 * 1024 px the enquiry card sits beside the details and the bar is not drawn. The page must leave room
 * under its last section so the bar never hides content. It holds no state and fetches nothing.
 */
export function ProjectMobileBar({
  contact,
  className,
}: {
  contact: ContactLinks;
  /** Added to the bar: the Design Lab draws it in the page instead of pinned to the screen. */
  className?: string;
}) {
  const translate = useTranslations("projects.page");
  const common = useTranslations("common");
  const newTab = common("opensInNewTab");
  return (
    <div
      data-slot="project-mobile-bar"
      className={cn(
        "fixed inset-x-0 bottom-0 z-sticky border-t border-line-strong bg-surface shadow-float lg:hidden",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-gutter py-3">
        {contact.call === null ? null : (
          <IconButton asChild aria-label={translate("actions.call")}>
            <Link href={contact.call} className="text-ink no-underline hover:text-ink">
              <Icon icon={Phone} />
            </Link>
          </IconButton>
        )}
        {contact.whatsapp === null ? null : (
          <IconButton asChild aria-label={`${translate("actions.whatsapp")} ${newTab}`}>
            <Link
              href={contact.whatsapp}
              external
              newTabLabel={newTab}
              className="text-ink no-underline hover:text-ink"
            >
              <Icon icon={MessageCircle} />
            </Link>
          </IconButton>
        )}
        <Button asChild variant="accent" className="min-w-0 flex-1">
          <Link href="#enquiry" className="text-on-cta no-underline hover:text-on-cta">
            {translate("bar.enquire")}
          </Link>
        </Button>
      </div>
      {/* The phone's home bar, so the button is never under it. */}
      <div aria-hidden="true" className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}
