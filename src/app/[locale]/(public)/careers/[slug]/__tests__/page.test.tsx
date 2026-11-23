import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  require: vi.fn(),
  moduleOn: vi.fn(),
  job: vi.fn(),
  isOpen: vi.fn(),
  metadata: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/features/site", () => ({
  requireContentModule: mocks.require,
  getContentModuleOn: mocks.moduleOn,
  getTranslate: async () => (key: string) => key,
}));
vi.mock("@/features/seo", () => ({ siteOrigin: () => "https://findsprop.test" }));
vi.mock("@/features/careers", () => ({
  JobScreen: () => null,
  getJob: mocks.job,
  isJobOpenAt: mocks.isOpen,
  jobMetadata: mocks.metadata,
  parseJobSlug: (value: string) => (/^[a-z0-9-]+$/.test(value) ? value : null),
}));

const { default: JobPage, generateMetadata } = await import("../page");

type Element = { props: { children: { props: Record<string, unknown> } } };
const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
const JOB = { id: "j", slug: "site-engineer", title: "Site engineer", closesAt: null };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.require.mockResolvedValue(undefined);
  mocks.moduleOn.mockResolvedValue(true);
  mocks.job.mockResolvedValue(JOB);
  mocks.isOpen.mockReturnValue(true);
});

describe("the public /careers/[slug] page (ADR-143, ADR-147)", () => {
  it("is not found while the module is off, without reading the job", async () => {
    mocks.require.mockRejectedValue(new Error("NEXT_NOT_FOUND"));
    await expect(JobPage(params("site-engineer"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.require).toHaveBeenCalledWith("careers");
    expect(mocks.job).not.toHaveBeenCalled();
  });

  it("is not found for an address that is not a slug and for a job that is not there", async () => {
    await expect(JobPage(params("Not A Slug"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.job).not.toHaveBeenCalled();
    mocks.job.mockResolvedValue(null);
    await expect(JobPage(params("gone"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("hands the screen the job, the site origin and whether it is still open now", async () => {
    const element = (await JobPage(params("site-engineer"))) as unknown as Element;
    expect(mocks.job).toHaveBeenCalledWith("site-engineer");
    expect(element.props.children.props).toEqual({
      job: JOB,
      open: true,
      origin: "https://findsprop.test",
    });
    mocks.isOpen.mockReturnValue(false);
    const closed = (await JobPage(params("site-engineer"))) as unknown as Element;
    expect(closed.props.children.props["open"]).toBe(false);
  });

  it("makes the job metadata, and only a title for a job that is not there", async () => {
    mocks.metadata.mockReturnValue({ title: "Site engineer" });
    expect(await generateMetadata(params("site-engineer"))).toEqual({ title: "Site engineer" });
    mocks.job.mockResolvedValue(null);
    expect(await generateMetadata(params("gone"))).toEqual({ title: "notFound.title" });
    expect(await generateMetadata(params("Not A Slug"))).toEqual({ title: "notFound.title" });
  });

  it("gives a hidden Careers module's job no metadata of its own, and does not even read it", async () => {
    mocks.moduleOn.mockResolvedValue(false);
    expect(await generateMetadata(params("site-engineer"))).toEqual({ title: "notFound.title" });
    expect(mocks.moduleOn).toHaveBeenCalledWith("careers");
    expect(mocks.job).not.toHaveBeenCalled();
    expect(mocks.metadata).not.toHaveBeenCalled();
  });
});
