// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import messages from "@/i18n/messages/en.json";
import { TooltipProvider } from "@/components/ui/tooltip";
import { JobApplyButton } from "../job-apply-button";
import { JobCard, JobCardSkeleton, type JobCardData } from "../job-card";
import { JobClosePosting } from "../job-close-posting";
import { JobDetailBody, JobDetailHeader } from "../job-detail-sections";
import { JobFilters, type JobFilterChoice } from "../job-filters";
import { JobFormFields, type JobFormValues } from "../job-form-fields";
import { JobManager, type JobManagerProps, type JobRow } from "../job-manager";

/** What renderWithMessages wraps around a component, for a rerender. */
const wrap = (ui: ReactElement) => (
  <NextIntlClientProvider locale="en" messages={messages}>
    <TooltipProvider>{ui}</TooltipProvider>
  </NextIntlClientProvider>
);

const JOB: JobCardData = {
  href: "/careers/site-engineer",
  title: "Site Engineer",
  department: "Engineering",
  location: "Chennai",
  workMode: "hybrid",
  employmentType: "full_time",
  experience: "2 to 4 years",
  summary: "Supervise our sites.",
  salaryNote: "4 to 6 lakh a year",
  closesAt: "2026-12-31T18:30:00+05:30",
};

describe("JobCard (ADR-143): one open job in the list", () => {
  it("makes the title the one link, with the badges, the place and the experience named", () => {
    renderWithMessages(<JobCard job={JOB} />);
    const link = screen.getByRole("link", { name: "Site Engineer" });
    expect(link).toHaveAttribute("href", "/careers/site-engineer");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    for (const word of ["Engineering", "Hybrid", "Full time"]) {
      expect(screen.getByText(word)).toBeInTheDocument();
    }
    expect(screen.getByText(/Chennai/)).toBeInTheDocument();
    expect(screen.getByText(/2 to 4 years/)).toBeInTheDocument();
    expect(screen.getByText("4 to 6 lakh a year")).toBeInTheDocument();
  });

  it("says when applications close, in a time element", () => {
    const { container } = renderWithMessages(<JobCard job={JOB} />);
    const time = container.querySelector("time");
    expect(time).toHaveAttribute("datetime", "2026-12-31T18:30:00+05:30");
    expect(time?.textContent).toMatch(/^Apply by .*2026/);
  });

  it("leaves out the facts it was not given instead of showing blanks", () => {
    const { container } = renderWithMessages(
      <JobCard
        job={{
          href: "#job",
          title: "Office Assistant",
          location: "Coimbatore",
          workMode: "remote",
          employmentType: "internship",
        }}
      />,
    );
    expect(container.querySelector("time")).toBeNull();
    expect(container.querySelectorAll("li")).toHaveLength(1);
    expect(screen.queryByText(/Experience/)).toBeNull();
    expect(container.querySelector("p.line-clamp-3")).toBeNull();
  });

  it("draws a search snippet with the matched words marked and typed markup as text", () => {
    const { container } = renderWithMessages(
      <JobCard job={{ ...JOB, snippet: "Talk to <b>buyers</b> about [[plots]] and [[homes]]." }} />,
    );
    const marks = [...container.querySelectorAll("mark")].map((mark) => mark.textContent);
    expect(marks).toEqual(["plots", "homes"]);
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<b>buyers</b>");
    expect(screen.queryByText("Supervise our sites.")).toBeNull();
  });

  it("has a loading shape that is hidden from assistive technology", () => {
    const { container } = renderWithMessages(<JobCardSkeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});

const CHOICES: JobFilterChoice[] = [
  {
    name: "department",
    label: "Department",
    allLabel: "All departments",
    value: "sales",
    options: [
      { value: "engineering", label: "Engineering" },
      { value: "sales", label: "Sales" },
    ],
  },
  {
    name: "mode",
    label: "Work mode",
    allLabel: "Any work mode",
    value: "",
    options: [{ value: "remote", label: "Remote" }],
  },
];

describe("JobFilters (ADR-143): search and filters in the address", () => {
  it("is a plain search form that sends the words by GET, with the box named and filled", () => {
    renderWithMessages(
      <JobFilters
        action="/careers"
        search={{ value: "site" }}
        filters={CHOICES}
        summary="2 jobs match"
      />,
    );
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("action", "/careers");
    expect(form).toHaveAttribute("method", "get");
    const box = within(form).getByRole("searchbox", { name: "Search the jobs" });
    expect(box).toHaveAttribute("name", "q");
    expect(box).toHaveValue("site");
    expect(within(form).getByRole("button", { name: "Search" })).toHaveAttribute("type", "submit");
  });

  it("offers a labelled choice for each filter, and says what was found in a polite status line", () => {
    renderWithMessages(
      <JobFilters
        action="/careers"
        search={{ value: "" }}
        filters={CHOICES}
        summary="2 jobs match"
      />,
    );
    expect(screen.getByText("Department")).toBeInTheDocument();
    expect(screen.getByText("Work mode")).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("2 jobs match");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("shows Clear only while something is chosen", () => {
    const { rerender } = renderWithMessages(
      <JobFilters
        action="/careers"
        search={{ value: "" }}
        filters={CHOICES}
        summary="14 open jobs"
      />,
    );
    expect(screen.queryByRole("link", { name: "Clear search and filters" })).toBeNull();
    rerender(
      wrap(
        <JobFilters
          action="/careers"
          search={{ value: "x" }}
          filters={CHOICES}
          summary="0 jobs match"
          clearHref="/careers"
        />,
      ),
    );
    expect(screen.getByRole("link", { name: "Clear search and filters" })).toHaveAttribute(
      "href",
      "/careers",
    );
  });
});

const DETAIL = {
  title: "Site Engineer",
  department: "Engineering",
  summary: "Supervise our sites.",
  location: "Chennai",
  workMode: "onsite" as const,
  employmentType: "full_time" as const,
  experience: "2 to 4 years",
  salaryNote: "4 to 6 lakh a year",
  postedAt: "2026-11-01T10:00:00+05:30",
  closesAt: "2026-12-31T18:30:00+05:30",
};

describe("JobDetailHeader and JobDetailBody (ADR-143): the job page", () => {
  it("has the title as the page's only level-1 heading and lists the facts with their names", () => {
    renderWithMessages(<JobDetailHeader job={DETAIL} />);
    expect(screen.getByRole("heading", { level: 1, name: "Site Engineer" })).toBeInTheDocument();
    const facts = screen.getByText("Location").closest("dl") as HTMLElement;
    expect(within(facts).getByText("Chennai")).toBeInTheDocument();
    for (const name of ["Experience", "Pay", "Posted", "Apply by"]) {
      expect(within(facts).getByText(name)).toBeInTheDocument();
    }
  });

  it("leaves out the facts it was not given", () => {
    renderWithMessages(
      <JobDetailHeader
        job={{
          title: "Office Assistant",
          location: "Coimbatore",
          workMode: "remote",
          employmentType: "internship",
        }}
      />,
    );
    expect(document.querySelectorAll("dt")).toHaveLength(1);
  });

  it("draws the description in paragraphs and the other two as lists, each under a level-2 heading", () => {
    renderWithMessages(
      <JobDetailBody
        job={{
          description: "One.\n\nTwo.",
          responsibilities: "Visit sites\nWrite reports",
          requirements: "A degree",
        }}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "About the job" })).toBeInTheDocument();
    expect(screen.getByText("One.")).toBeInTheDocument();
    expect(screen.getByText("Two.")).toBeInTheDocument();
    const lists = screen.getAllByRole("list");
    expect(lists).toHaveLength(2);
    expect(within(lists[0] as HTMLElement).getAllByRole("listitem")).toHaveLength(2);
    expect(
      screen.getByRole("heading", { level: 2, name: "What we are looking for" }),
    ).toBeInTheDocument();
  });

  it("leaves out a section with no text, with its heading, and never draws typed markup", () => {
    const { container } = renderWithMessages(
      <JobDetailBody job={{ description: "Help with <b>papers</b>.", requirements: "" }} />,
    );
    expect(screen.queryByRole("heading", { name: "What you will do" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "What we are looking for" })).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<b>papers</b>");
  });
});

describe("JobApplyButton (ADR-143, D4): a link or an email, or a note", () => {
  it("opens an external link in a new tab, safely, and says so", () => {
    renderWithMessages(
      <JobApplyButton
        apply={{ kind: "link", url: "https://jobs.example.test/x" }}
        title="Site Engineer"
        openJobsHref="/careers"
      />,
    );
    const link = screen.getByRole("link", { name: /Apply for this job/ });
    expect(link).toHaveAttribute("href", "https://jobs.example.test/x");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link).toHaveTextContent("Site Engineer");
    expect(link).toHaveTextContent("(opens in a new tab)");
  });

  it("makes a mailto link with the subject filled in", () => {
    renderWithMessages(
      <JobApplyButton
        apply={{ kind: "email", address: "careers@example.test" }}
        title="Site Engineer & Planner"
        openJobsHref="/careers"
      />,
    );
    const link = screen.getByRole("link", { name: /Apply by email/ });
    expect(link).toHaveAttribute(
      "href",
      "mailto:careers@example.test?subject=Application%3A%20Site%20Engineer%20%26%20Planner",
    );
    expect(link).not.toHaveAttribute("target");
    expect(screen.getByText(/careers@example.test/)).toBeInTheDocument();
  });

  it("gives way to a note and a link to the open jobs when the job has closed, with no Apply button", () => {
    renderWithMessages(
      <JobApplyButton
        apply={{ kind: "link", url: "https://jobs.example.test/x" }}
        title="Site Engineer"
        open={false}
        openJobsHref="/careers"
      />,
    );
    expect(screen.getByText("This job is no longer open")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Apply for this job/ })).toBeNull();
    expect(screen.getByRole("link", { name: "See open jobs" })).toHaveAttribute("href", "/careers");
  });
});

function row(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: "a",
    title: "Site Engineer",
    departmentName: "Engineering",
    location: "Chennai",
    status: "open",
    updated: "20 Nov 2026",
    closes: "31 Dec 2026",
    editHref: "/admin/careers/a",
    step: { kind: "close", onClick: vi.fn() },
    trash: { onClick: vi.fn() },
    ...overrides,
  };
}

function manager(overrides: Partial<JobManagerProps> = {}): JobManagerProps {
  return {
    addHref: "/admin/careers/new",
    onDepartments: vi.fn(),
    tabs: {
      options: [
        { value: "all", count: 3 },
        { value: "open", count: 1 },
        { value: "draft", count: 1 },
        { value: "closed", count: 1 },
        { value: "trash", count: 0 },
      ],
      value: "all",
      onChange: vi.fn(),
    },
    department: {
      options: [{ value: "engineering", label: "Engineering" }],
      value: "",
      onChange: vi.fn(),
    },
    search: { value: "", onChange: vi.fn() },
    caption: "Jobs",
    rows: [row()],
    countText: "1 of 3 jobs",
    ...overrides,
  };
}

describe("JobManager (ADR-143): the admin's list", () => {
  it("shows the heading, Add job as a link, Departments as a button and the count line", () => {
    const props = manager();
    renderWithMessages(<JobManager {...props} />);
    expect(screen.getByRole("heading", { level: 1, name: "Careers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add job" })).toHaveAttribute(
      "href",
      "/admin/careers/new",
    );
    fireEvent.click(screen.getByRole("button", { name: "Departments" }));
    expect(props.onDepartments).toHaveBeenCalledTimes(1);
    expect(screen.getByText("1 of 3 jobs")).toBeInTheDocument();
  });

  it("gives each row Edit (a link naming the job), the step button and Move to Trash", () => {
    const props = manager();
    renderWithMessages(<JobManager {...props} />);
    expect(screen.getAllByRole("link", { name: "Edit Site Engineer" })[0]).toHaveAttribute(
      "href",
      "/admin/careers/a",
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Close posting Site Engineer" })[0] as HTMLElement,
    );
    expect(props.rows[0]?.step.onClick).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Move Site Engineer to the Trash" })[0] as HTMLElement,
    );
    expect(props.rows[0]?.trash?.onClick).toHaveBeenCalledTimes(1);
  });

  it("says the status in words: Open, Expired, Draft, Closed and In the Trash (with Restore and no Edit)", () => {
    renderWithMessages(
      <JobManager
        {...manager({
          rows: [
            row({ id: "1", title: "One" }),
            row({
              id: "2",
              title: "Two",
              expired: true,
              step: { kind: "reopen", onClick: vi.fn() },
            }),
            row({
              id: "3",
              title: "Three",
              status: "draft",
              closes: null,
              step: { kind: "open", onClick: vi.fn() },
            }),
            row({
              id: "4",
              title: "Four",
              status: "closed",
              step: { kind: "reopen", onClick: vi.fn() },
            }),
            row({
              id: "5",
              title: "Five",
              trashed: true,
              step: { kind: "restore", onClick: vi.fn() },
            }),
          ],
        })}
      />,
    );
    for (const word of ["Open", "Expired", "Draft", "Closed", "In the Trash"]) {
      expect(screen.getAllByText(word).length).toBeGreaterThan(0);
    }
    expect(screen.queryByRole("link", { name: "Edit Five" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Restore Five" }).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("No date").length).toBeGreaterThan(0);
  });

  it("switches every row button off while the list is being changed", () => {
    renderWithMessages(<JobManager {...manager({ pending: true })} />);
    for (const button of screen.getAllByRole("button", {
      name: /Close posting|Move .* to the Trash/,
    })) {
      expect(button).toBeDisabled();
    }
  });

  it("marks the chosen tab and reports a change of tab and typing", () => {
    const props = manager();
    renderWithMessages(<JobManager {...props} />);
    expect(screen.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /^Closed/ }));
    expect(props.tabs.onChange).toHaveBeenCalledWith("closed");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search the jobs" }), {
      target: { value: "site" },
    });
    expect(props.search.onChange).toHaveBeenCalledWith("site");
  });

  it("shows the empty state with Add job when there are none, and 'no match' when a filter finds none", () => {
    const { rerender } = renderWithMessages(<JobManager {...manager({ rows: [] })} />);
    expect(screen.getByRole("heading", { name: "No jobs yet" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Add job" })).toHaveLength(2);
    rerender(
      wrap(<JobManager {...manager({ rows: [], search: { value: "zzz", onChange: vi.fn() } })} />),
    );
    expect(screen.getByRole("heading", { name: "No jobs match" })).toBeInTheDocument();
  });
});

const VALUES: JobFormValues = {
  title: "Site Engineer",
  slug: "site-engineer",
  departmentId: "engineering",
  location: "Chennai",
  workMode: "onsite",
  employmentType: "full_time",
  experience: "",
  summary: "Short.",
  description: "Long.",
  responsibilities: "",
  requirements: "A degree",
  salaryNote: "",
  applyKind: "link",
  applyUrl: "https://jobs.example.test/x",
  applyEmail: "",
  closesAt: "",
};

const LIMITS = {
  title: 160,
  location: 120,
  experience: 80,
  summary: 320,
  description: 8000,
  responsibilities: 4000,
  requirements: 4000,
  salaryNote: 120,
};

describe("JobFormFields (ADR-143): the job page", () => {
  it("labels every box, counts the long text and reports each change as the new values", () => {
    const onChange = vi.fn();
    renderWithMessages(
      <JobFormFields
        values={VALUES}
        onChange={onChange}
        departments={[{ value: "engineering", label: "Engineering" }]}
        limits={LIMITS}
      />,
    );
    expect(screen.getByLabelText("Job title")).toHaveValue("Site Engineer");
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByText("5 / 8000")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Job title"), { target: { value: "Site Planner" } });
    expect(onChange).toHaveBeenCalledWith({ ...VALUES, title: "Site Planner" });
  });

  it("shows the box for the chosen way to apply, one at a time", () => {
    const { rerender } = renderWithMessages(
      <JobFormFields values={VALUES} onChange={vi.fn()} departments={[]} limits={LIMITS} />,
    );
    expect(screen.getByLabelText("Apply link")).toBeInTheDocument();
    expect(screen.queryByLabelText("Apply email address")).toBeNull();
    rerender(
      wrap(
        <JobFormFields
          values={{ ...VALUES, applyKind: "email", applyEmail: "a@example.test" }}
          onChange={vi.fn()}
          departments={[]}
          limits={LIMITS}
        />,
      ),
    );
    expect(screen.getByLabelText("Apply email address")).toHaveValue("a@example.test");
    expect(screen.queryByLabelText("Apply link")).toBeNull();
  });

  it("shows the problems beside their boxes", () => {
    renderWithMessages(
      <JobFormFields
        values={VALUES}
        onChange={vi.fn()}
        departments={[]}
        limits={LIMITS}
        errors={{
          title: "Use at least 3 characters.",
          applyUrl: "Enter a full link that starts with https://.",
        }}
      />,
    );
    expect(screen.getByLabelText("Job title")).toHaveAccessibleDescription(
      expect.stringContaining("Use at least 3 characters."),
    );
    expect(screen.getByLabelText("Apply link")).toBeInvalid();
  });

  it("warns that a new address changes the link of a job that is open, and says to add a department first when there is none", () => {
    const { rerender } = renderWithMessages(
      <JobFormFields values={VALUES} onChange={vi.fn()} departments={[]} limits={LIMITS} />,
    );
    expect(screen.getByText(/add one first/)).toBeInTheDocument();
    expect(screen.queryByText(/old link stops working/)).toBeNull();
    rerender(
      wrap(
        <JobFormFields values={VALUES} onChange={vi.fn()} departments={[]} limits={LIMITS} open />,
      ),
    );
    expect(screen.getByText(/old link stops working/)).toBeInTheDocument();
  });

  it("turns every box off while saving", () => {
    renderWithMessages(
      <JobFormFields
        values={VALUES}
        onChange={vi.fn()}
        departments={[]}
        limits={LIMITS}
        disabled
      />,
    );
    expect(screen.getByLabelText("Job title")).toBeDisabled();
    expect(screen.getByLabelText("Description")).toBeDisabled();
    expect(screen.getByLabelText("Last moment to apply")).toBeDisabled();
  });
});

describe("JobClosePosting (ADR-143): the button and its question", () => {
  it("opens the question from the button, and names the job in it", () => {
    const onOpenChange = vi.fn();
    renderWithMessages(
      <JobClosePosting
        title="Site Engineer"
        open={false}
        onOpenChange={onOpenChange}
        onConfirm={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close posting" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("asks before closing, puts focus on Keep it open and confirms only on Close posting", () => {
    const onConfirm = vi.fn();
    renderWithMessages(
      <JobClosePosting title="Site Engineer" open onOpenChange={vi.fn()} onConfirm={onConfirm} />,
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Close the posting for Site Engineer?");
    expect(within(dialog).getByRole("button", { name: "Keep it open" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close posting" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("turns the button off, with the reason, when the job is not open", () => {
    renderWithMessages(
      <JobClosePosting
        title="Site Engineer"
        open={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByRole("button", { name: "Close posting" })).toBeDisabled();
    expect(screen.getByText("Only an open job can be closed.")).toBeInTheDocument();
  });
});
