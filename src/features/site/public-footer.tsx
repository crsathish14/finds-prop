import { Mail, MapPin, Phone } from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { Logo } from "@/components/ui/logo";
import { buildFooter } from "./chrome";
import { getCurrentYear } from "./current-year";
import { getFeatureFlags } from "./flags";
import { getSiteSettings } from "./queries";
import { getTranslate } from "./translator";

const CONTACT_ICONS = { address: MapPin, phone: Phone, email: Mail } as const;

/**
 * The footer of the public pages (S4-T06): brand, the about text, the link column, contact lines
 * and the legal line, all from the cached site content, the flags and the message catalogue. It
 * reads no cookies, so it is part of the page's static shell.
 */
export async function PublicFooter() {
  const translate = await getTranslate();
  const settings = await getSiteSettings();
  const footer = buildFooter(settings, getFeatureFlags(), translate, await getCurrentYear());

  return (
    <SiteFooter
      logo={
        <Link
          href="/"
          aria-label={translate("site.header.homeLabel", { brandName: footer.brandName })}
          className="no-underline"
        >
          <Logo name={footer.brandName} tone="on-dark" />
        </Link>
      }
      {...(footer.about ? { about: footer.about } : {})}
      navLabel={translate("site.footer.navLabel")}
      columns={
        footer.links.length > 0 ? [{ heading: footer.columnHeading, links: footer.links }] : []
      }
      contacts={footer.contacts.map((contact) => ({
        icon: <Icon icon={CONTACT_ICONS[contact.kind]} />,
        text: contact.text,
        ...(contact.href ? { href: contact.href } : {}),
      }))}
      legal={{ copyright: footer.copyright, links: footer.legalLinks }}
    />
  );
}
