// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  result: { status: "missing" } as
    { status: "missing" } | { status: "found"; project: Record<string, unknown> },
  asked: [] as string[],
}));

class Signal extends Error {}
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Signal("NOT_FOUND");
  },
  permanentRedirect: (to: string) => {
    throw new Signal(`REDIRECT ${to}`);
  },
}));
vi.mock("@/features/site", () => ({ getTranslate: async () => (key: string) => key }));
vi.mock("@/lib/public-env", () => ({
  publicEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SITE_URL: "https://findsprop.test",
  },
}));
vi.mock("@/components/domain/enquiry-card", () => ({ EnquiryCardSkeleton: () => null }));
vi.mock("@/features/property", async () => ({
  enquiryLinks: (
    await vi.importActual<{ enquiryLinks: unknown }>("@/features/property/enquiry-links")
  ).enquiryLinks,
}));
vi.mock("@/features/home", () => ({
  PROJECT_BUCKET: "project-media",
  publicStorageUrl: (base: string, bucket: string, path: string) => `${base}/${bucket}/${path}`,
}));
vi.mock("@/features/projects", async () => {
  const address = await vi.importActual("@/features/projects/address");
  const view = await vi.importActual<{ projectMetaDescription: unknown; contactLinks: unknown }>(
    "@/features/projects/view",
  );
  const data = await vi.importActual<{ projectStructuredData: unknown }>(
    "@/features/projects/structured-data",
  );
  return {
    ...address,
    projectStructuredData: data.projectStructuredData,
    projectMetaDescription: view.projectMetaDescription,
    contactLinks: view.contactLinks,
    ProjectEnquirySlot: (props: {
      slug: string;
      signInHref: string;
      createAccountHref: string;
    }) => (
      <div
        data-testid="lead"
        data-slug={props.slug}
        data-sign-in={props.signInHref}
        data-create={props.createAccountHref}
      />
    ),
    ProjectViewTracker: (props: { slug: string }) => (
      <div data-testid="tracker" data-slug={props.slug} />
    ),
    ProjectMobileBar: (props: { contact: { call: string | null; whatsapp: string | null } }) => (
      <div
        data-testid="bar"
        data-call={props.contact.call ?? ""}
        data-whatsapp={props.contact.whatsapp ?? ""}
      />
    ),
    getProject: async (slug: string) => {
      state.asked.push(slug);
      return state.result;
    },
    ProjectScreen: (props: {
      imageSources: string[];
      floorPlanSources: string[];
      brochureSource: string | null;
      project: { name: string };
      enquiry?: ReactNode;
      mobileEnquiry?: ReactNode;
    }) => (
      <div
        data-testid="screen"
        data-images={props.imageSources.join("|")}
        data-plans={props.floorPlanSources.join("|")}
        data-brochure={props.brochureSource ?? ""}
      >
        {props.project.name}
        {props.enquiry}
        {props.mobileEnquiry}
      </div>
    ),
  };
});

const { default: ProjectPage, generateMetadata } = await import("../(public)/projects/[slug]/page");

const found = (overrides: Record<string, unknown> = {}) => ({
  status: "found" as const,
  project: {
    slug: "kadal-vista",
    name: "Kadal Vista",
    seoTitle: null,
    seoDescription: null,
    description: "A gated community.",
    images: ["kadal/1.webp"],
    floorPlans: ["kadal/plan.webp"],
    brochurePath: "kadal/brochure.pdf",
    contactPhone: "+914412345678",
    locality: "OMR",
    developer: { id: "d1", name: "Sea Homes" },
    amenities: ["Pool"],
    totalUnits: 120,
    ...overrides,
  },
});

const props = (slug: string) => ({ params: Promise.resolve({ slug }) });

beforeEach(() => {
  state.result = { status: "missing" };
  state.asked = [];
});

describe("the project page (S4-T09)", () => {
  it("is not found for an address that is not a slug, without reading anything", async () => {
    await expect(ProjectPage(props("kadal vista"))).rejects.toThrow("NOT_FOUND");
    expect(state.asked).toEqual([]);
  });

  it("is not found when no approved, published project has the slug", async () => {
    await expect(ProjectPage(props("nobody-here"))).rejects.toThrow("NOT_FOUND");
    expect(state.asked).toEqual(["nobody-here"]);
  });

  it("sends a slug written with capitals to the canonical address", async () => {
    state.result = found();
    await expect(ProjectPage(props("Kadal-Vista"))).rejects.toThrow(
      "REDIRECT /projects/kadal-vista",
    );
  });

  it("gives the screen the project and the addresses of its files in public storage", async () => {
    state.result = found();
    render(await ProjectPage(props("kadal-vista")));
    const node = screen.getByTestId("screen");
    expect(node).toHaveTextContent("Kadal Vista");
    expect(node).toHaveAttribute(
      "data-images",
      "https://example.supabase.co/project-media/kadal/1.webp",
    );
    expect(node).toHaveAttribute(
      "data-plans",
      "https://example.supabase.co/project-media/kadal/plan.webp",
    );
    expect(node).toHaveAttribute(
      "data-brochure",
      "https://example.supabase.co/project-media/kadal/brochure.pdf",
    );
  });

  it("puts the enquiry card, with the project and the sign-in links that lead back to it, in the screen", async () => {
    state.result = found();
    render(await ProjectPage(props("kadal-vista")));
    const lead = screen.getByTestId("lead");
    expect(lead).toHaveAttribute("data-slug", "kadal-vista");
    expect(lead).toHaveAttribute(
      "data-sign-in",
      "/auth?gate=enquire&redirect=%2Fprojects%2Fkadal-vista",
    );
    expect(lead).toHaveAttribute("data-create", "/auth?redirect=%2Fprojects%2Fkadal-vista");
  });

  it("records the view of the project it shows, by the stored slug", async () => {
    state.result = found();
    render(await ProjectPage(props("kadal-vista")));
    expect(screen.getByTestId("tracker")).toHaveAttribute("data-slug", "kadal-vista");
  });

  it("draws the phone bar with the links the project's number allows", async () => {
    state.result = found();
    const first = render(await ProjectPage(props("kadal-vista")));
    expect(screen.getByTestId("bar")).toHaveAttribute("data-call", "tel:+914412345678");
    expect(screen.getByTestId("bar")).toHaveAttribute(
      "data-whatsapp",
      "https://wa.me/914412345678",
    );
    first.unmount();
    state.result = found({ contactPhone: null });
    render(await ProjectPage(props("kadal-vista")));
    expect(screen.getByTestId("bar")).toHaveAttribute("data-call", "");
  });

  it("leaves room under the last section for the phone bar", async () => {
    state.result = found();
    const { container } = render(await ProjectPage(props("kadal-vista")));
    expect(container.querySelector("main")).toHaveClass("pb-24", "lg:pb-0");
  });

  it("gives no brochure address when the project has none", async () => {
    state.result = found({ brochurePath: null });
    render(await ProjectPage(props("kadal-vista")));
    expect(screen.getByTestId("screen")).toHaveAttribute("data-brochure", "");
  });

  it("titles the page from the project's own words, describes it, and gives it one canonical address", async () => {
    state.result = found({ seoTitle: "  Kadal Vista, OMR  " });
    const metadata = await generateMetadata(props("kadal-vista"));
    expect(metadata.title).toBe("Kadal Vista, OMR");
    expect(metadata.description).toBe("A gated community.");
    expect(metadata.alternates?.canonical).toBe("/projects/kadal-vista");
    expect(metadata.openGraph).toMatchObject({
      title: "Kadal Vista, OMR",
      url: "/projects/kadal-vista",
      images: [{ url: "https://example.supabase.co/project-media/kadal/1.webp" }],
    });
  });

  it("falls back to the project's name when it has no SEO title", async () => {
    state.result = found();
    expect((await generateMetadata(props("kadal-vista"))).title).toBe("Kadal Vista");
  });

  it("describes a project with no words of its own from its name, developer and place", async () => {
    state.result = found({ description: null });
    expect((await generateMetadata(props("kadal-vista"))).description).toBe(
      "projects.page.metaFallback",
    );
  });

  it("shares the default image for a project with no pictures", async () => {
    state.result = found({ images: [] });
    const metadata = await generateMetadata(props("kadal-vista"));
    expect(metadata.openGraph).toMatchObject({ images: [{ url: "/share-image.png" }] });
  });

  it("titles a missing project as not found, and does not read for a bad address", async () => {
    expect(await generateMetadata(props("nobody-here"))).toEqual({
      title: "projects.page.notFound.title",
    });
    state.asked = [];
    expect(await generateMetadata(props("bad slug"))).toEqual({
      title: "projects.page.notFound.title",
    });
    expect(state.asked).toEqual([]);
  });

  it("carries the project's structured data and its breadcrumb trail, with whole addresses", async () => {
    state.result = found();
    const { container } = render(await ProjectPage(props("kadal-vista")));
    const documents = [...container.querySelectorAll('script[type="application/ld+json"]')].map(
      (script) => JSON.parse(script.textContent ?? ""),
    );
    expect(documents).toHaveLength(2);
    expect(documents[0]).toMatchObject({
      "@type": "ApartmentComplex",
      name: "Kadal Vista",
      url: "https://findsprop.test/projects/kadal-vista",
    });
    expect(documents[1]).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { position: 1, name: "projects.page.crumb.home", item: "https://findsprop.test/" },
        {
          position: 2,
          name: "projects.page.crumb.projects",
          item: "https://findsprop.test/projects",
        },
        {
          position: 3,
          name: "Kadal Vista",
          item: "https://findsprop.test/projects/kadal-vista",
        },
      ],
    });
  });
});
