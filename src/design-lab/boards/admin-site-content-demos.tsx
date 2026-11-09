"use client";

import { useState, type ReactNode } from "react";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { SiteContentLayout, type SiteContentTab } from "@/components/domain/site-content-layout";
import {
  SiteFooterFields,
  type SiteFooterErrors,
  type SiteFooterFieldsWords,
  type SiteFooterValues,
} from "@/components/domain/site-footer-fields";
import { SiteFooterPreview } from "@/components/domain/site-footer-preview";
import {
  SiteHeaderFields,
  type SiteHeaderErrors,
  type SiteHeaderFieldsWords,
  type SiteHeaderValues,
} from "@/components/domain/site-header-fields";
import { SiteHeaderPreview } from "@/components/domain/site-header-preview";
import { Alert } from "@/components/patterns/alert";
import {
  LinkListField,
  type LinkListWords,
  type LinkRow,
  type LinkRowErrors,
} from "@/components/patterns/link-list-field";
import { Specimen } from "../frame";

/**
 * The Site content editor's parts in their states (S7-T10, part B1): the frame with its tabs and preview, the list of
 * links, the Header and Footer boxes and their previews. Plain English text; nothing here goes anywhere. The Hero
 * and Homepage boxes come with part B2. The words that are not in the approved UX file are listed in ADR-090 for the
 * owner to confirm.
 */

const LINK_WORDS: LinkListWords = {
  row: "Link",
  label: "Label",
  link: "Link address",
  add: "Add link",
  remove: "Remove",
  drag: "Drag",
  moveUp: "Move up",
  moveDown: "Move down",
  empty: "No links yet.",
  full: "The list is full.",
};

const HEADER_WORDS: SiteHeaderFieldsWords = {
  brand: { title: "Brand", description: "Leave the name empty to use Find Prop." },
  links: {
    title: "Navigation links",
    description:
      "Shown across the top of every page. Leave the list empty to use the standard links.",
  },
  cta: {
    title: "Call to action",
    description: "A button at the right end of the header. Leave both boxes empty for no button.",
  },
  name: "Site name",
  ctaLabel: "Button label",
  ctaHref: "Button link",
  optional: "(optional)",
  linkList: LINK_WORDS,
};

const FOOTER_WORDS: SiteFooterFieldsWords = {
  contact: {
    title: "About and contact",
    description: "Shown at the bottom of every page. An empty box is left out.",
  },
  links: { title: "Links", description: "Shown in the footer, in this order." },
  about: "About text",
  phone: "Phone",
  email: "Email",
  address: "Address",
  copyright: "Copyright line",
  optional: "(optional)",
  linkList: LINK_WORDS,
};

const tab = (key: string, label: string, current: string): SiteContentTab => ({
  key,
  label,
  href: `/admin/${key}`,
  current: key === current,
});

const tabs = (current: string) => [
  tab("header", "Header", current),
  tab("hero", "Hero", current),
  tab("homepage", "Homepage", current),
  tab("footer", "Footer", current),
];

const row = (id: string, label: string, href: string): LinkRow => ({ id, label, href });

const HEADER_LINKS = [
  row("h1", "Buy", "/properties?listingType=sale"),
  row("h2", "Rent", "/properties?listingType=rent"),
  row("h3", "Projects", "/projects"),
];

const HEADER_FILLED: SiteHeaderValues = {
  name: "Find Prop",
  links: HEADER_LINKS,
  ctaLabel: "Post property",
  ctaHref: "/post-property",
};

const HEADER_STANDARD: SiteHeaderValues = { name: "", links: [], ctaLabel: "", ctaHref: "" };

const FOOTER_FILLED: SiteFooterValues = {
  about:
    "Search, shortlist and compare homes across Tamil Nadu, and enquire directly with owners and builders.",
  phone: "+91 90000 00000",
  email: "hello@findprop.example",
  address: "Chennai, Tamil Nadu",
  links: [row("f1", "Contact us", "/contact"), row("f2", "Builder sign in", "/builder/login")],
  copyright: "© 2026 Find Prop",
};

const FOOTER_STANDARD: SiteFooterValues = {
  about: "",
  phone: "",
  email: "",
  address: "",
  links: [],
  copyright: "",
};

const SAVE_NOTE = "Saved changes appear on the public site straight away.";
const SAVE_WORDS = { cancel: "Discard", save: "Save changes", saving: "Saving" };

function SaveBar({ saving = false }: { saving?: boolean }) {
  return (
    <ProjectSaveBar
      note={SAVE_NOTE}
      words={SAVE_WORDS}
      saving={saving}
      sticky={false}
      onCancel={() => undefined}
    />
  );
}

/** The header preview as the page works it out: the standard name when the box is empty. */
function headerPreview(values: SiteHeaderValues): ReactNode {
  const links = values.links.map((link) => link.label.trim()).filter(Boolean);
  const cta = values.ctaLabel.trim();
  return (
    <SiteHeaderPreview
      brandName={values.name.trim() || "Find Prop"}
      links={links}
      {...(cta ? { cta } : {})}
    />
  );
}

function footerPreview(values: SiteFooterValues): ReactNode {
  const about = values.about.trim();
  return (
    <SiteFooterPreview
      brandName="Find Prop"
      {...(about ? { about } : {})}
      contacts={[values.address, values.phone, values.email]
        .map((line) => line.trim())
        .filter(Boolean)}
      links={values.links.map((link) => link.label.trim()).filter(Boolean)}
      copyright={values.copyright.trim() || "© 2026 Find Prop"}
    />
  );
}

function HeaderPage({
  initial,
  errors,
  top,
  saving = false,
}: {
  initial: SiteHeaderValues;
  errors?: SiteHeaderErrors;
  top?: ReactNode;
  saving?: boolean;
}) {
  const [values, setValues] = useState(initial);
  return (
    <SiteContentLayout
      title="Header"
      description="The navigation across the top of every public page."
      tabs={tabs("header")}
      tabsLabel="Site content"
      previewLabel="Preview"
      preview={headerPreview(values)}
      {...(top ? { top } : {})}
      footer={<SaveBar saving={saving} />}
    >
      <SiteHeaderFields
        values={values}
        {...(errors ? { errors } : {})}
        onChange={setValues}
        linksMax={12}
        disabled={saving}
        words={HEADER_WORDS}
      />
    </SiteContentLayout>
  );
}

function FooterPage({ initial, errors }: { initial: SiteFooterValues; errors?: SiteFooterErrors }) {
  const [values, setValues] = useState(initial);
  return (
    <SiteContentLayout
      title="Footer"
      description="The text, contact details and links at the bottom of every public page."
      tabs={tabs("footer")}
      tabsLabel="Site content"
      previewLabel="Preview"
      preview={footerPreview(values)}
      footer={<SaveBar />}
    >
      <SiteFooterFields
        values={values}
        {...(errors ? { errors } : {})}
        onChange={setValues}
        linksMax={20}
        words={FOOTER_WORDS}
      />
    </SiteContentLayout>
  );
}

export function SiteContentFrameDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="The Header page: filled, with its preview beside the boxes from 1100 px of screen and under them below (type in a box, reorder the links, add one)">
        <HeaderPage initial={HEADER_FILLED} />
      </Specimen>
      <Specimen label="The Header page with nothing saved: the standard name, links and no button; the preview shows the standard name">
        <HeaderPage initial={HEADER_STANDARD} />
      </Specimen>
      <Specimen label="Saved with problems: the alert on top, the boxes that need work marked">
        <HeaderPage
          initial={{
            name: "",
            links: [row("e1", "Buy", "javascript:alert(1)"), row("e2", "", "/projects")],
            ctaLabel: "Post property",
            ctaHref: "",
          }}
          errors={{
            ctaHref: "This field is required.",
            links: {
              e1: {
                href: "Enter a page on this site, starting with /, or a full address starting with https://",
              },
              e2: { label: "This field is required." },
            },
          }}
          top={
            <Alert tone="danger" title="3 things need attention">
              Check the two links and the button before saving.
            </Alert>
          }
        />
      </Specimen>
      <Specimen label="Saving: every box is off and Save says Saving">
        <HeaderPage initial={HEADER_FILLED} saving />
      </Specimen>
    </div>
  );
}

function LinksState({
  initial,
  max,
  errors,
  disabled,
}: {
  initial: LinkRow[];
  max: number;
  errors?: Record<string, LinkRowErrors>;
  disabled?: boolean;
}) {
  const [links, setLinks] = useState(initial);
  return (
    <div className="w-full max-w-170 rounded-xl border border-line bg-surface p-4 md:p-6">
      <LinkListField
        title="Navigation links"
        links={links}
        onChange={setLinks}
        max={max}
        {...(errors ? { errors } : {})}
        {...(disabled ? { disabled } : {})}
        words={LINK_WORDS}
      />
    </div>
  );
}

export function LinkListFieldDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Empty (Add link starts a new row at the end)">
        <LinksState initial={[]} max={12} />
      </Specimen>
      <Specimen label="Three links (drag the grip or use the arrows; the first row cannot go up, the last cannot go down)">
        <LinksState initial={HEADER_LINKS} max={12} />
      </Specimen>
      <Specimen label="Two rows with problems: the box, the words and an icon">
        <LinksState
          initial={[row("p1", "Buy", "ftp://example.com"), row("p2", "", "/projects")]}
          max={12}
          errors={{
            p1: {
              href: "Enter a page on this site, starting with /, or a full address starting with https://",
            },
            p2: { label: "This field is required." },
          }}
        />
      </Specimen>
      <Specimen label="Full (3 of 3): Add link is off and the list says so; Remove still works">
        <LinksState initial={HEADER_LINKS} max={3} />
      </Specimen>
      <Specimen label="A very long name and address stay inside their boxes">
        <LinksState
          initial={[
            row(
              "l1",
              "Homes for sale across Chennai, Coimbatore, Madurai and the rest of Tamil Nadu",
              "https://www.example.com/a/very/long/address/that/keeps/going/and/going/until/it/is/cut?with=query&and=more",
            ),
          ]}
          max={12}
        />
      </Specimen>
      <Specimen label="Saving: every box and button is off">
        <LinksState initial={HEADER_LINKS} max={12} disabled />
      </Specimen>
    </div>
  );
}

export function SiteFooterDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="The Footer page: filled, with its dark preview (type in a box to see it change)">
        <FooterPage initial={FOOTER_FILLED} />
      </Specimen>
      <Specimen label="The Footer page with nothing saved: every box empty, the preview shows only the standard copyright line">
        <FooterPage initial={FOOTER_STANDARD} />
      </Specimen>
      <Specimen label="Problems: a bad email and a link without a name">
        <FooterPage
          initial={{
            ...FOOTER_FILLED,
            email: "hello@",
            links: [row("g1", "", "/contact")],
          }}
          errors={{
            email: "Enter a valid email address, like name@example.com.",
            links: { g1: { label: "This field is required." } },
          }}
        />
      </Specimen>
      <Specimen label="The two previews alone, in the width of their column: a long name and many links wrap">
        <div className="flex w-full max-w-80 flex-col gap-4">
          <SiteHeaderPreview
            brandName="Kadal Homes and Habitats"
            links={["Buy", "Rent", "Projects", "AI search", "Contact"]}
            cta="Post property"
          />
          <SiteHeaderPreview brandName="Find Prop" links={[]} />
          <SiteFooterPreview
            brandName="Find Prop"
            contacts={[]}
            links={[]}
            copyright="© 2026 Find Prop"
          />
        </div>
      </Specimen>
    </div>
  );
}
