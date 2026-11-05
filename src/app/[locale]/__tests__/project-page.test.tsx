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
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
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
  return {
    ...address,
    projectMetaDescription: view.projectMetaDescription,
    contactLinks: view.contactLinks,
    ProjectLeadCard: (props: { state: string; sendDisabled?: boolean; sendNotice?: string }) => (
      <div
        data-testid="lead"
        data-state={props.state}
        data-disabled={String(props.sendDisabled ?? false)}
        data-notice={props.sendNotice ?? ""}
      />
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

  it("draws the enquiry card with Send switched off and says why", async () => {
    state.result = found();
    render(await ProjectPage(props("kadal-vista")));
    const lead = screen.getByTestId("lead");
    expect(lead).toHaveAttribute("data-state", "form");
    expect(lead).toHaveAttribute("data-disabled", "true");
    expect(lead).toHaveAttribute("data-notice", "projects.page.lead.notOpen");
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

  it("titles the page from the project's own words, and describes it", async () => {
    state.result = found({ seoTitle: "  Kadal Vista, OMR  " });
    expect(await generateMetadata(props("kadal-vista"))).toEqual({
      title: "Kadal Vista, OMR",
      description: "A gated community.",
    });
  });

  it("falls back to the project's name when it has no SEO title", async () => {
    state.result = found();
    expect((await generateMetadata(props("kadal-vista"))).title).toBe("Kadal Vista");
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
});
