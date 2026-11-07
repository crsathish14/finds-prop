/**
 * Whole-page previews for the organisms that change with the screen width. Each is served at
 * /design-system/preview/<name> and shown in an iframe on a board (DeviceFrame), and also visited
 * directly at 390, 820 and 1440 px by the Design Lab tests.
 */
import { Bell, Heart } from "lucide-react";
import type { ReactNode } from "react";
import { AvatarMenu } from "@/components/layout/avatar-menu";
import { BottomBar } from "@/components/layout/bottom-bar";
import { Container } from "@/components/layout/container";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { PortalShell } from "@/components/layout/portal-shell";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SponsorSlot } from "@/components/layout/sponsor-slot";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Link } from "@/components/ui/link";
import { Logo } from "@/components/ui/logo";
import { Text } from "@/components/ui/text";
import { resolveHero, type HeroLayout, type SponsorAd } from "@/lib/sponsors";
import { NEAR_MISS_AD, SAMPLE_AD_A, SAMPLE_AD_B, SAMPLE_AD_C } from "@/lib/sponsors.fixtures";
import { SearchCardHost } from "./boards/domain-demos-search";
import { BasicsStep, FailedAlert, ReviewStep, SampleWizard } from "./boards/seller-parts";
import type { PreviewName } from "./preview-names";
import {
  ACCOUNT_GROUPS,
  BOTTOM_BAR_ITEMS,
  FOOTER_COLUMNS,
  FOOTER_CONTACTS,
  MAIN_NAV,
  PORTAL_FOOTER,
  PORTAL_GROUPS,
} from "./sample-data";

const HOME_LINK = (
  <Link href="#home" aria-label="Find Prop, home" className="no-underline">
    <Logo name="Find Prop" />
  </Link>
);

function Drawer() {
  return (
    <MobileDrawer
      triggerLabel="Open menu"
      title="Menu"
      closeLabel="Close menu"
      nav={MAIN_NAV}
      groups={ACCOUNT_GROUPS}
      actions={
        <>
          <Button asChild variant="secondary">
            <Link href="#sign-in">Sign in</Link>
          </Button>
          <Button asChild variant="accent">
            <Link href="#post">Post property</Link>
          </Button>
        </>
      }
    />
  );
}

function PageBody({ children }: { children?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-gutter py-10">
      <Heading as="h1" size="1">
        Page content
      </Heading>
      <Text tone="muted">
        The header stays at the top while the page scrolls. This text is only here to give the page
        some height.
      </Text>
      {children}
      {Array.from({ length: 6 }, (_, index) => (
        <Text key={index}>
          Search, shortlist and compare homes across Chennai, and enquire directly with owners and
          builders. Every listing is checked before it appears.
        </Text>
      ))}
    </div>
  );
}

function HeaderSignedOut() {
  return (
    <>
      <SiteHeader
        logo={HOME_LINK}
        navLabel="Main"
        nav={MAIN_NAV}
        bordered
        actions={
          <>
            <Link href="#sign-in" variant="nav" className="px-3 py-3 text-primary no-underline">
              Sign in
            </Link>
            <Button asChild variant="secondary" size="sm" pill className="hidden md:inline-flex">
              <Link href="#post">Post property</Link>
            </Button>
          </>
        }
        menu={<Drawer />}
      />
      <main id="main">
        <PageBody />
      </main>
    </>
  );
}

function HeaderSignedIn() {
  return (
    <>
      <SiteHeader
        logo={HOME_LINK}
        navLabel="Main"
        nav={MAIN_NAV}
        actions={
          <>
            <IconButton aria-label="Saved homes" className="hidden text-primary md:inline-grid">
              <Icon icon={Heart} />
            </IconButton>
            <IconButton aria-label="Notifications" className="hidden text-primary md:inline-grid">
              <Icon icon={Bell} />
            </IconButton>
            <Button asChild variant="secondary" size="sm" pill className="hidden md:inline-flex">
              <Link href="#post">Post property</Link>
            </Button>
            <AvatarMenu
              triggerLabel="Account menu"
              name="Priya Raman"
              email="priya@example.com"
              initials="PR"
              roleLabel="Owner"
              groups={ACCOUNT_GROUPS}
            />
          </>
        }
        menu={<Drawer />}
      />
      <main id="main">
        <PageBody />
      </main>
    </>
  );
}

function BottomBarPage() {
  return (
    <>
      <main id="main" className="pb-bottombar md:pb-0">
        <PageBody />
      </main>
      <BottomBar navLabel="Primary" items={BOTTOM_BAR_ITEMS} />
    </>
  );
}

function FooterPage() {
  return (
    <>
      <main id="main">
        <PageBody />
      </main>
      <SiteFooter
        logo={
          <Link href="#home" aria-label="Find Prop, home" className="no-underline">
            <Logo name="Find Prop" tone="on-dark" />
          </Link>
        }
        about="Search, shortlist and compare homes across Chennai, and enquire directly with owners and builders."
        navLabel="Footer"
        columns={FOOTER_COLUMNS}
        contacts={FOOTER_CONTACTS}
        legal={{
          copyright: "© 2026 Find Prop. Sample footer.",
          links: [
            { label: "Privacy", href: "#privacy" },
            { label: "Terms", href: "#terms" },
          ],
        }}
      />
    </>
  );
}

function PortalPage() {
  return (
    <PortalShell
      brand={
        <Link href="#home" aria-label="Find Prop, home" className="no-underline">
          <Logo name="Find Prop" tone="on-dark" />
        </Link>
      }
      portalTag="Admin"
      navLabel="Admin"
      groups={PORTAL_GROUPS}
      footerItems={PORTAL_FOOTER}
      mobileLogo={
        <Link href="#home" aria-label="Find Prop, home" className="no-underline">
          <Logo name="Find Prop" />
        </Link>
      }
      mobileMenu={{ triggerLabel: "Open menu", title: "Admin menu", closeLabel: "Close menu" }}
      topBar={
        <>
          <Link
            href="#site"
            className="hidden px-3 py-3 text-small font-semibold no-underline md:inline-flex"
          >
            View site
          </Link>
          <AvatarMenu
            triggerLabel="Account menu"
            name="Asha Menon"
            email="asha@example.com"
            initials="AM"
            roleLabel="Admin"
            roleTone="admin"
            groups={ACCOUNT_GROUPS.slice(-1)}
          />
        </>
      }
    >
      <div className="flex flex-col gap-2 pb-6">
        <Heading as="h1" size="1">
          Overview
        </Heading>
        <Text tone="muted">
          Sample portal page. The sidebar is a drawer on phones, an icon rail on tablets and the
          full sidebar from 1100 px.
        </Text>
      </div>
    </PortalShell>
  );
}

function HeroPage({ ads, layout }: { ads: SponsorAd[]; layout: HeroLayout }) {
  const hero = resolveHero(ads, layout);
  const split = hero.arrangement === "split";
  return (
    <Container as="main" id="main" className="py-10">
      <div
        className={
          split
            ? "grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,var(--w-sponsor-panel))]"
            : "flex flex-col gap-4"
        }
      >
        <div className="flex flex-col gap-4">
          <Heading as="h1" size={split ? "1" : "display"} className={split ? "" : "text-center"}>
            Find the place that fits your life
          </Heading>
          <SearchCardHost layout={split ? "stacked" : "wide"} />
          {split ? null : <SponsorSlot ads={ads} placement="hero" layout={layout} />}
        </div>
        {split ? <SponsorSlot ads={ads} placement="hero" layout={layout} /> : null}
      </div>
      <Text className="mt-10">
        The next section starts here, with no gap where an ad would have been.
      </Text>
    </Container>
  );
}

export const PREVIEWS: Record<PreviewName, () => ReactNode> = {
  "header-signed-out": HeaderSignedOut,
  "header-signed-in": HeaderSignedIn,
  "bottom-bar": BottomBarPage,
  footer: FooterPage,
  "portal-admin": PortalPage,
  "hero-a-one-ad": () => <HeroPage ads={[SAMPLE_AD_A]} layout="search_desk" />,
  "hero-a-three-ads": () => (
    <HeroPage ads={[SAMPLE_AD_A, SAMPLE_AD_B, SAMPLE_AD_C]} layout="search_desk" />
  ),
  "hero-a-near-miss": () => <HeroPage ads={[NEAR_MISS_AD]} layout="search_desk" />,
  "hero-b-one-ad": () => <HeroPage ads={[SAMPLE_AD_A]} layout="split" />,
  "hero-b-three-ads": () => (
    <HeroPage ads={[SAMPLE_AD_A, SAMPLE_AD_B, SAMPLE_AD_C]} layout="split" />
  ),
  "hero-b-near-miss": () => <HeroPage ads={[NEAR_MISS_AD]} layout="split" />,
  "hero-none": () => <HeroPage ads={[]} layout="search_desk" />,
  "hero-split-without-ad": () => <HeroPage ads={[]} layout="split" />,
  "wizard-basics": () => (
    <SampleWizard current={1} inline={false}>
      <BasicsStep />
    </SampleWizard>
  ),
  "wizard-review": () => (
    <SampleWizard current={5} inline={false} alert={<FailedAlert />}>
      <ReviewStep />
    </SampleWizard>
  ),
};
