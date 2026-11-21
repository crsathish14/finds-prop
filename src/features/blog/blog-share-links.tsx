import { useTranslations } from "next-intl";
import { Chip } from "@/components/ui/chip";
import { Link } from "@/components/ui/link";

type BlogShareLinksProps = {
  /** The article's whole address and its title: what the share links carry. */
  url: string;
  title: string;
};

/**
 * "Share this article": plain links that open each service's own share page in a new tab, with the article's address and
 * title in the link. Nothing is loaded from the services until a reader follows one (no script, no widget, no
 * tracking). The email link opens the reader's own mail program. Built from the site's Chip and Link, so it adds no part.
 */
export function BlogShareLinks({ url, title }: BlogShareLinksProps) {
  const translate = useTranslations("blog.article.share");
  const address = encodeURIComponent(url);
  const text = encodeURIComponent(title);
  const targets = [
    {
      key: "whatsapp",
      label: translate("networks.whatsapp"),
      href: `https://wa.me/?text=${text}%20${address}`,
    },
    {
      key: "facebook",
      label: translate("networks.facebook"),
      href: `https://www.facebook.com/sharer/sharer.php?u=${address}`,
    },
    {
      key: "x",
      label: translate("networks.x"),
      href: `https://twitter.com/intent/tweet?url=${address}&text=${text}`,
    },
    {
      key: "linkedin",
      label: translate("networks.linkedin"),
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${address}`,
    },
  ] as const;
  const emailHref = `mailto:?subject=${text}&body=${address}`;
  return (
    <section aria-labelledby="blog-share-title" className="flex flex-col gap-3">
      <p id="blog-share-title" className="text-overline text-muted">
        {translate("title")}
      </p>
      <ul className="flex flex-wrap gap-2">
        {targets.map((target) => (
          <li key={target.key}>
            <Chip asChild size="sm">
              <Link href={target.href} external newTabLabel={translate("newTab")}>
                {target.label}
              </Link>
            </Chip>
          </li>
        ))}
        <li>
          <Chip asChild size="sm">
            <Link href={emailHref}>{translate("networks.email")}</Link>
          </Chip>
        </li>
      </ul>
    </section>
  );
}
