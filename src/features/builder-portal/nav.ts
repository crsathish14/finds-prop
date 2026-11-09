import type { AdminNavGroup } from "@/features/admin";
import type { Translate } from "@/lib/format";

/**
 * The builder portal's sidebar as plain data (S7-T03, FR-BLD-01): the one list of the approved builder navigation (UX
 * assets, portal shell), with its words already looked up. It has the same shape as the admin's, so the same shell
 * draws it. Literal message keys, so the messages check sees them. No numbers beside the links.
 */
export function buildBuilderNav(translate: Translate): AdminNavGroup[] {
  return [
    {
      items: [
        {
          key: "dashboard",
          href: "/builder/dashboard",
          label: translate("builderPortal.nav.dashboard"),
          icon: "dashboard",
        },
        {
          key: "projects",
          href: "/builder/projects",
          label: translate("builderPortal.nav.projects"),
          icon: "projects",
        },
        {
          key: "units",
          href: "/builder/units",
          label: translate("builderPortal.nav.units"),
          icon: "units",
        },
        {
          key: "leads",
          href: "/builder/leads",
          label: translate("builderPortal.nav.leads"),
          icon: "leads",
        },
        {
          key: "insights",
          href: "/builder/insights",
          label: translate("builderPortal.nav.insights"),
          icon: "insights",
        },
        {
          key: "profile",
          href: "/builder/profile",
          label: translate("builderPortal.nav.profile"),
          icon: "profile",
        },
      ],
    },
  ];
}
