// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { EnquiryList } from "../enquiry-list";
import type { SentEnquiry } from "../view";

const NOW = Date.parse("2026-11-06T12:00:00Z");
const words = en.enquiries.list;

const sent = (overrides: Partial<SentEnquiry> = {}): SentEnquiry => ({
  id: "e1",
  sentAt: "2026-11-06T10:00:00Z",
  status: "new",
  message: "Is the apartment still available?",
  home: { href: "/properties/sea-view-k3x9a2bd", title: "Sea view 2 BHK" },
  ...overrides,
});

describe("EnquiryList: the My enquiries tab (S5-T03, FR-ACC-05)", () => {
  it("lists each enquiry with its home as a link, how long ago it was sent, the status and the message", () => {
    renderWithMessages(<EnquiryList enquiries={[sent()]} now={NOW} />);
    const list = screen.getByRole("list", { name: words.listLabel });
    expect(within(list).getByRole("link", { name: "Sea view 2 BHK" })).toHaveAttribute(
      "href",
      "/properties/sea-view-k3x9a2bd",
    );
    expect(within(list).getByText("Sent 2 hours ago")).toBeInTheDocument();
    expect(within(list).getByText(en.status.enquiry.waitingForOwner)).toBeInTheDocument();
    expect(within(list).getByText("Is the apartment still available?")).toBeInTheDocument();
  });

  it("shows the three statuses in the sender's words", () => {
    renderWithMessages(
      <EnquiryList
        enquiries={[
          sent({ id: "a", status: "new" }),
          sent({ id: "b", status: "contacted" }),
          sent({ id: "c", status: "closed" }),
        ]}
        now={NOW}
      />,
    );
    expect(screen.getByText(en.status.enquiry.waitingForOwner)).toBeInTheDocument();
    expect(screen.getByText(en.status.enquiry.contacted)).toBeInTheDocument();
    expect(screen.getByText(en.status.enquiry.closed)).toBeInTheDocument();
    expect(screen.queryByText(en.status.enquiry.new)).toBeNull();
  });

  it("keeps an enquiry for a home that is no longer listed, with no link", () => {
    renderWithMessages(<EnquiryList enquiries={[sent({ home: null })]} now={NOW} />);
    expect(screen.getByText(words.homeGone)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Is the apartment still available?")).toBeInTheDocument();
  });

  it("draws nothing for a message that was left empty", () => {
    renderWithMessages(<EnquiryList enquiries={[sent({ message: null })]} now={NOW} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText("Is the apartment still available?")).toBeNull();
  });
});
