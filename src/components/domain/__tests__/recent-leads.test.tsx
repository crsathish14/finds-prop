// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecentLeads, type RecentLead } from "../recent-leads";

const EMPTY = { title: "No leads yet", text: "New leads will show here." };

const LEADS: RecentLead[] = [
  {
    id: "1",
    name: "Arjun Menon",
    initials: "AM",
    meta: "Kadal Vista · Enquiry",
    when: "12 min ago",
  },
  {
    id: "2",
    name: "Divya Krishnan",
    initials: "DK",
    meta: "Arivu Heights · Site visit",
    when: "1 hr ago",
    tone: "copper",
  },
];

function leads(extra: Partial<Parameters<typeof RecentLeads>[0]> = {}) {
  return render(<RecentLeads leads={LEADS} label="Recent leads" empty={EMPTY} {...extra} />);
}

describe("RecentLeads (S7-T06)", () => {
  it("is a list with a line for each lead: the name, what they asked about and how long ago", () => {
    leads();
    const list = screen.getByRole("list", { name: "Recent leads" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Arjun Menon");
    expect(items[0]).toHaveTextContent("Kadal Vista · Enquiry");
    expect(items[0]).toHaveTextContent("12 min ago");
    expect(items[1]).toHaveTextContent("Divya Krishnan");
  });

  it("hides the avatar's initials from a screen reader, because the name is beside it", () => {
    leads();
    const hidden = document.querySelectorAll("[aria-hidden='true']");
    expect(hidden.length).toBe(2);
    expect([...hidden].map((node) => node.textContent)).toEqual(["AM", "DK"]);
  });

  it("colours a copper avatar apart from the others", () => {
    leads();
    const [first, second] = [...document.querySelectorAll("[data-slot='avatar-fallback']")];
    expect(first?.className).not.toContain("bg-cta-tint");
    expect(second?.className).toContain("bg-cta-tint");
  });

  it("cuts a long name and line instead of pushing the time out", () => {
    leads({
      leads: [
        {
          id: "3",
          name: "A very long name that does not fit on one line of the box",
          initials: "AV",
          meta: "A very long project name · A very long kind of lead",
          when: "5 hr ago",
        },
      ],
    });
    expect(screen.getByText(/A very long name/).className).toContain("truncate");
    expect(screen.getByText(/A very long project name/).className).toContain("truncate");
    expect(screen.getByText("5 hr ago")).toBeVisible();
  });

  it("says there are no leads yet, with no list", () => {
    leads({ leads: [] });
    expect(screen.getByText("No leads yet")).toBeVisible();
    expect(screen.getByText("New leads will show here.")).toBeVisible();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
