import type { LabEntry } from "../types";
import { JobClosePostingDemo, JobFormDemo, JobManagerDemo } from "./admin-careers-demos";
import { JobApplyDemo, JobCardDemo, JobDetailDemo, JobFiltersDemo } from "./careers-demos";

/**
 * What Careers is drawn with (ADR-143 phase 4): on the public side the job card, the search and filters with the empty
 * and loading states, the job page's header and body, and the Apply button; on the admin side the list of jobs, the
 * job form and the Close posting button with its question. It has its own board because the Site content board had
 * grown too tall to photograph in one go. It mirrors the admin Site content screen, the nearest approved design, until
 * the owner approves a Careers design.
 */
export const CAREERS: LabEntry[] = [
  {
    id: "job-card",
    name: "Job card",
    description:
      "One open job in the Careers list and in search results (ADR-143): the department, work mode and type as badges, the title as the card's one link, the place and the experience, a short summary and when applications close. Missing facts are left out. A search result shows a passage around the matched words with the matches marked. Shown with every fact, as a search result, with only the required facts, with a very long title, department, place and word, and loading.",
    sources: ["domain/job-card.tsx"],
    Demo: JobCardDemo,
  },
  {
    id: "job-filters",
    name: "Job filters",
    description:
      "What narrows the Careers list (ADR-143 section 4), all kept in the address so a filtered list can be linked: the search box (a search landmark with a hidden label and a Search button), and a Department, Location, Work mode and Job type choice, with the count of open jobs or of matches and a way to clear everything. It is one form, so it works without scripts. Shown with nothing chosen, with words and two filters chosen, with no match (the empty state under the bar) and with no open job at all.",
    sources: ["domain/job-filters.tsx", "ui/select.tsx", "patterns/empty-state.tsx"],
    Demo: JobFiltersDemo,
  },
  {
    id: "job-detail",
    name: "Job detail sections",
    description:
      "The parts of a job page (ADR-143): the header (department and badges, the page's only level-1 title, the summary and the facts: place, experience, pay, posted and closing dates), and the body (the description in paragraphs, the responsibilities and the requirements as lists, all plain text so typed markup shows as typed). Shown with every fact, with only the required facts and no responsibilities, and with a very long title and unbroken words.",
    sources: ["domain/job-detail-sections.tsx"],
    Demo: JobDetailDemo,
  },
  {
    id: "job-apply",
    name: "Job apply button",
    description:
      "How a visitor applies (ADR-143, decision D4): the platform stores no applications, so the button is a link to the employer's own page, opened in a new tab, or an email with the subject filled in, with a line saying what will happen. When the job has closed it gives way to a note and a link back to the open jobs. It is the one copper button of the page. Shown for a link, for an email and for a closed job.",
    sources: ["domain/job-apply-button.tsx"],
    Demo: JobApplyDemo,
  },
  {
    id: "job-manager",
    name: "Job admin list",
    description:
      "The admin's list of jobs (ADR-143 section 5): the heading with Add job and Departments, tabs for All, Open, Drafts, Closed and Trash with counts, a department filter and a search, a table that becomes cards below 1024 px of room, and on each row its status as a word (an open job past its closing date says Expired), Edit, Open, Close posting or Reopen, and Move to Trash (Restore in the Trash). Shown as a try-it list, the Trash tab, a list being changed, nothing yet and no match.",
    sources: [
      "domain/job-manager.tsx",
      "patterns/responsive-table.tsx",
      "patterns/form-field.tsx",
      "ui/chip.tsx",
    ],
    Demo: JobManagerDemo,
  },
  {
    id: "job-form",
    name: "Job form",
    description:
      "The boxes of the Careers editor (ADR-143 section 5), in four sections: Basics (title, address with a warning when the job is open, department, place, experience, work mode and type), About the job (summary, description, responsibilities and requirements, with counters), How to apply (a link or an email, never both, and an optional pay note) and the Closing date. They sit above the project form's save bar. Shown empty (try it), an open job being edited, with problems on the boxes, saving and with no department yet.",
    sources: [
      "domain/job-form-fields.tsx",
      "patterns/form-section.tsx",
      "ui/segmented-control.tsx",
      "domain/project-save-bar.tsx",
    ],
    Demo: JobFormDemo,
  },
  {
    id: "job-close-posting",
    name: "Close posting",
    description:
      "The Close posting button of the job editor and the question it asks first (ADR-143 section 5). Closing takes the job off the site at once; it stays in the list as Closed and can be opened again. The question puts focus on Keep it open, so Enter never closes a posting by accident. Shown as a try-it button (the confirm works for a moment) and off, with its reason, when the job is not open.",
    sources: ["domain/job-close-posting.tsx", "patterns/confirm-dialog.tsx"],
    Demo: JobClosePostingDemo,
  },
];
