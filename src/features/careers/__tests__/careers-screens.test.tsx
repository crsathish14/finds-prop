// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { CareersListScreen, jobCardDataOf } from "../careers-list-screen";
import { CareersListSkeleton, JobSkeleton } from "../careers-skeleton";
import { applyOf, JobScreen } from "../job-screen";
import type { PublicJobParams } from "../page-params";
import type { CareersPageData } from "../queries";
import type { JobCardView, JobDetailView } from "../view";

const words = en.careers.page;

const card = (slug: string, extra: Partial<JobCardView> = {}): JobCardView => ({
  id: `id-${slug}`,
  slug,
  title: `Title of ${slug}`,
  department: { slug: "sales", name: "Sales" },
  location: "Chennai",
  workMode: "hybrid",
  employmentType: "full_time",
  experience: "3 years",
  summary: `Summary of ${slug}.`,
  snippet: null,
  salaryNote: null,
  closesAt: null,
  postedAt: "2026-11-10T08:00:00+00:00",
  ...extra,
});

const DATA: CareersPageData = {
  list: {
    items: [card("one"), card("two", { snippet: "Run the [[site]] team" })],
    total: 30,
    page: 2,
    pageSize: 12,
    pageCount: 3,
  },
  filters: {
    departments: [
      { slug: "sales", name: "Sales" },
      { slug: "legal", name: "Legal" },
    ],
    locations: ["Chennai", "Madurai"],
    total: 30,
  },
  department: "",
  nothingOpen: false,
};
const NO_PARAMS: PublicJobParams = {
  query: "",
  department: "",
  location: "",
  mode: "" as const,
  type: "" as const,
  page: 2,
};

function list(data: CareersPageData = DATA, params = NO_PARAMS) {
  return renderWithMessages(<CareersListScreen data={data} params={params} />);
}

describe("CareersListScreen (ADR-143): the public Careers list", () => {
  it("has the one level-1 title, the breadcrumb, the search box and the four filters", () => {
    list();
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: words.crumb.nav })).toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: en.careers.filters.searchLabel }),
    ).toBeInTheDocument();
    for (const label of [
      en.careers.filters.department,
      en.careers.filters.location,
      en.careers.filters.workMode,
      en.careers.filters.type,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("sends the four filters by name, with the chosen values kept", () => {
    const { container } = list(
      { ...DATA, department: "legal" },
      { ...NO_PARAMS, location: "Madurai", mode: "remote", type: "contract" },
    );
    const value = (name: string) =>
      container.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value;
    expect(value("department")).toBe("legal");
    expect(value("location")).toBe("Madurai");
    expect(value("mode")).toBe("remote");
    expect(value("type")).toBe("contract");
  });

  it("draws a card for each job with a link to its own page, and the matched words marked", () => {
    list();
    const link = screen.getByRole("link", { name: "Title of one" });
    expect(link).toHaveAttribute("href", "/careers/one");
    expect(screen.getByRole("link", { name: "Title of two" })).toHaveAttribute(
      "href",
      "/careers/two",
    );
    expect(screen.getByText("site").tagName).toBe("MARK");
  });

  it("says how many jobs are open, and how many match once something is chosen", () => {
    list();
    expect(screen.getByText("30 open jobs")).toBeInTheDocument();
    list(DATA, { ...NO_PARAMS, query: "site" });
    expect(screen.getByText("30 jobs match")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: en.careers.filters.clear }).length).toBeGreaterThan(
      0,
    );
  });

  it("links the previous page with the filters kept and page 1 left out", () => {
    list(DATA, { ...NO_PARAMS, mode: "remote", page: 2 });
    const previous = screen.getByRole("link", { name: /previous/i });
    expect(previous.getAttribute("href")).toBe("/careers?mode=remote");
  });

  it("says so when no job is open at all, and offers no search", () => {
    list({
      ...DATA,
      list: { ...DATA.list, items: [], total: 0, page: 1, pageCount: 1 },
      nothingOpen: true,
    });
    expect(screen.getByText(en.careers.empty.title)).toBeInTheDocument();
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
  });

  it("says so when nothing matches and offers the whole list", () => {
    list(
      { ...DATA, list: { ...DATA.list, items: [], total: 0, page: 1, pageCount: 1 } },
      { ...NO_PARAMS, query: "zzz", page: 1 },
    );
    expect(screen.getByText(en.careers.noMatches.title)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.careers.noMatches.reset })).toHaveAttribute(
      "href",
      "/careers",
    );
  });

  it("leaves out an empty experience and summary from a card", () => {
    const data = jobCardDataOf(card("x", { experience: "", summary: "" }));
    expect(data.experience).toBeUndefined();
    expect(data.summary).toBeUndefined();
    expect(data.href).toBe("/careers/x");
    expect(data.department).toBe("Sales");
  });
});

const JOB: JobDetailView = {
  id: "j1",
  slug: "site-engineer",
  title: "Site engineer",
  departmentId: "d1",
  department: { slug: "sales", name: "Sales" },
  location: "Chennai",
  workMode: "remote",
  employmentType: "contract",
  experience: "3 years",
  summary: "Run our sites.",
  description: "Paragraph one.\n\nParagraph two.",
  responsibilities: "Plan the work\nBuild it",
  requirements: "A degree",
  salaryNote: "Negotiable",
  applyUrl: "https://jobs.example.com/apply",
  applyEmail: null,
  closesAt: null,
  postedAt: "2026-11-10T08:00:00+00:00",
  updatedAt: "2026-11-12T08:00:00+00:00",
};

function job(extra: Partial<JobDetailView> = {}, open = true) {
  return renderWithMessages(
    <JobScreen job={{ ...JOB, ...extra }} open={open} origin="https://findsprop.test" />,
  );
}

describe("JobScreen (ADR-143, ADR-147): the public job page", () => {
  it("has the one level-1 title, the breadcrumb, the facts and the body in sections", () => {
    job();
    expect(screen.getByRole("heading", { level: 1, name: "Site engineer" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: en.careers.page.crumb.nav })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: en.careers.detail.description }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: en.careers.detail.responsibilities }),
    ).toBeInTheDocument();
    expect(screen.getByText("Plan the work")).toBeInTheDocument();
    expect(screen.getByText("Negotiable")).toBeInTheDocument();
  });

  it("applies by an external link that opens in a new tab", () => {
    job();
    const apply = screen.getByRole("link", { name: /Apply for this job/ });
    expect(apply).toHaveAttribute("href", "https://jobs.example.com/apply");
    expect(apply).toHaveAttribute("target", "_blank");
    expect(apply.getAttribute("rel")).toContain("noopener");
  });

  it("applies by email with the job in the subject", () => {
    job({ applyUrl: null, applyEmail: "hr@example.com" });
    const apply = screen.getByRole("link", { name: /Apply by email/ });
    expect(apply.getAttribute("href")).toBe(
      "mailto:hr@example.com?subject=" + encodeURIComponent("Application: Site engineer"),
    );
  });

  it("draws the closed note and no Apply button once the job has closed, and no job posting data", () => {
    const { container } = job({}, false);
    expect(screen.getByText(en.careers.apply.closed)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Apply for this job/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.careers.apply.seeJobs })).toHaveAttribute(
      "href",
      "/careers",
    );
    expect(container.innerHTML).not.toContain("JobPosting");
  });

  it("writes the structured data of an open job as text, with the escaping the page relies on", () => {
    const { container } = job({ title: "Engineer </script><b>x</b>" });
    const scripts = [...container.querySelectorAll('script[type="application/ld+json"]')];
    expect(scripts.length).toBe(2);
    expect(scripts[0]?.textContent).toContain("JobPosting");
    expect(scripts[0]?.textContent).not.toContain("</script>");
  });

  it("draws the text the admin typed as text, never as markup", () => {
    job({ description: "<img src=x onerror=alert(1)>" });
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("applyOf", () => {
  it("prefers the link, then the email, and is null for neither", () => {
    expect(applyOf(JOB)).toEqual({ kind: "link", url: "https://jobs.example.com/apply" });
    expect(applyOf({ ...JOB, applyUrl: null, applyEmail: "a@b.co" })).toEqual({
      kind: "email",
      address: "a@b.co",
    });
    expect(applyOf({ ...JOB, applyUrl: null })).toBeNull();
  });
});

describe("the skeletons", () => {
  it("are hidden from assistive technology so the page can name itself busy", () => {
    const { container } = renderWithMessages(
      <>
        <CareersListSkeleton />
        <JobSkeleton />
      </>,
    );
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
