// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import messages from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { Alert } from "../../patterns/alert";
import { ChatAssistantMessage, ChatStreamCaret } from "../chat-assistant-message";
import { ChatComposer } from "../chat-composer.client";
import { ChatConfirmCard } from "../chat-confirm-card.client";
import { ChatGate } from "../chat-gate.client";
import { ChatNoteLine } from "../chat-note-line";
import { ChatNotice } from "../chat-notice";
import { ChatStatusLine } from "../chat-status-line";
import { ChatThread } from "../chat-thread";
import { ChatRemovedToken, ChatUserBubble } from "../chat-user-bubble";

const words = messages.ai;
const enquiryWords = messages.domain.enquiry;

describe("the chat thread, the bubble and the assistant's message (AI-P5-T01)", () => {
  it("labels the conversation and says who spoke in each message", () => {
    renderWithMessages(
      <ChatThread>
        <ChatUserBubble>3 BHK in Velachery</ChatUserBubble>
        <ChatAssistantMessage>
          <p>I found two homes.</p>
        </ChatAssistantMessage>
      </ChatThread>,
    );
    const thread = screen.getByRole("list", { name: words.thread.label });
    const [bubble, answer] = within(thread).getAllByRole("listitem");
    expect(bubble).toHaveTextContent(`${words.thread.youSaid} 3 BHK in Velachery`);
    expect(answer).toHaveTextContent(words.assistantName);
    expect(answer).toHaveTextContent(words.thread.assistantSaid);
  });

  it("shows the visitor's text as text, never as markup", () => {
    renderWithMessages(
      <ChatThread>
        <ChatUserBubble>
          {"<img src=x onerror=alert(1)> and <b>bold</b>"}{" "}
          <ChatRemovedToken>phone removed</ChatRemovedToken>
        </ChatUserBubble>
      </ChatThread>,
    );
    expect(screen.getByText(/<img src=x/)).toBeVisible();
    expect(document.querySelector("img, b")).toBeNull();
    expect(screen.getByText("phone removed")).toBeVisible();
  });

  it("marks a streaming answer busy and puts the caret where the text ends", () => {
    const { container } = renderWithMessages(
      <ChatThread>
        <ChatAssistantMessage streaming>
          <p>
            Two homes, and
            <ChatStreamCaret />
          </p>
        </ChatAssistantMessage>
      </ChatThread>,
    );
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(container.querySelector("p [aria-hidden='true']")).not.toBeNull();
  });

  it("an answer that is finished is not busy, and holds its cards and notes after the text", () => {
    const { container } = renderWithMessages(
      <ChatThread>
        <ChatAssistantMessage
          cards={<article>A card</article>}
          notes={<ChatNoteLine>{words.capNote}</ChatNoteLine>}
        >
          <p>Here is what I found.</p>
        </ChatAssistantMessage>
      </ChatThread>,
    );
    expect(container.querySelector("[aria-busy='true']")).toBeNull();
    const text = container.textContent ?? "";
    expect(text.indexOf("Here is what I found.")).toBeLessThan(text.indexOf("A card"));
    expect(text.indexOf("A card")).toBeLessThan(text.indexOf(words.capNote));
  });

  it("shows the Searching status as a polite status, and notes as notes", () => {
    renderWithMessages(
      <>
        <ChatStatusLine />
        <ChatNoteLine>{words.disclaimer}</ChatNoteLine>
        <ChatNoteLine live align="user">
          {words.maskedNotice}
        </ChatNoteLine>
      </>,
    );
    expect(screen.getByText(words.searching).closest("[role='status']")).not.toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent(words.disclaimer);
    expect(screen.getByText(words.maskedNotice).closest("[role='status']")).not.toBeNull();
  });
});

function Harness({ onSend, disabled = false }: { onSend: () => void; disabled?: boolean }) {
  const [value, setValue] = useState("");
  return (
    <ChatComposer
      value={value}
      onChange={setValue}
      onSend={onSend}
      maxLength={1000}
      disabled={disabled}
    />
  );
}

describe("ChatComposer", () => {
  it("has a label, the personal-details note and a counter", async () => {
    renderWithMessages(<Harness onSend={vi.fn()} />);
    const box = screen.getByRole("textbox", { name: words.composer.label });
    expect(box).toHaveAttribute("placeholder", words.composer.placeholder);
    expect(box).toHaveAccessibleDescription(words.composer.note);
    expect(screen.getByText("0 / 1,000")).toBeVisible();
    await userEvent.type(box, "Hello");
    expect(screen.getByText("5 / 1,000")).toBeVisible();
  });

  it("keeps Send off until there is text that is not only spaces", async () => {
    renderWithMessages(<Harness onSend={vi.fn()} />);
    const send = screen.getByRole("button", { name: words.composer.send });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox"), "   ");
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox"), "a");
    expect(send).toBeEnabled();
  });

  it("Enter sends, Shift+Enter adds a line, and an empty box never sends", async () => {
    const onSend = vi.fn();
    renderWithMessages(<Harness onSend={onSend} />);
    const box = screen.getByRole("textbox");
    await userEvent.type(box, "{Enter}");
    expect(onSend).not.toHaveBeenCalled();
    await userEvent.type(box, "one{Shift>}{Enter}{/Shift}two");
    expect(box).toHaveValue("one\ntwo");
    expect(onSend).not.toHaveBeenCalled();
    await userEvent.type(box, "{Enter}");
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("pressing Send calls onSend once", async () => {
    const onSend = vi.fn();
    renderWithMessages(<Harness onSend={onSend} />);
    await userEvent.type(screen.getByRole("textbox"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: words.composer.send }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("when off, the box and Send are off and nothing is sent", async () => {
    const onSend = vi.fn();
    renderWithMessages(
      <ChatComposer
        value="kept draft"
        onChange={vi.fn()}
        onSend={onSend}
        maxLength={1000}
        disabled
      />,
    );
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("textbox")).toHaveValue("kept draft");
    expect(screen.getByRole("button", { name: words.composer.send })).toBeDisabled();
  });

  it("stops the message at the limit", () => {
    renderWithMessages(
      <ChatComposer value="x" onChange={vi.fn()} onSend={vi.fn()} maxLength={40} />,
    );
    expect(screen.getByRole("textbox")).toHaveAttribute("maxlength", "40");
  });
});

describe("ChatNotice and Alert's urgent option", () => {
  it("reads an error and the two message limits at once, and 'unavailable' politely", () => {
    renderWithMessages(
      <>
        <ChatNotice kind="error" onRetry={vi.fn()} />
        <ChatNotice kind="too_many_messages" seconds={45} filtersHref="/properties" />
        <ChatNotice kind="daily_limit" />
        <ChatNotice kind="unavailable" filtersHref="/properties" />
      </>,
    );
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(3);
    expect(screen.getByRole("status")).toHaveTextContent(words.unavailableTitle);
  });

  it("Try again sends the same message again", async () => {
    const onRetry = vi.fn();
    renderWithMessages(<ChatNotice kind="error" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: words.notice.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("says how long to wait and links to the filters", () => {
    renderWithMessages(
      <ChatNotice kind="too_many_messages" seconds={45} filtersHref="/properties" />,
    );
    expect(screen.getByText(/45 seconds/)).toBeVisible();
    expect(screen.getByRole("link", { name: words.notice.useFilters })).toHaveAttribute(
      "href",
      "/properties",
    );
  });

  it("an Alert is read at once when it says urgent, whatever its tone", () => {
    renderWithMessages(
      <>
        <Alert tone="warning" urgent title="Now" />
        <Alert tone="danger" urgent={false} title="Polite" />
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Now");
    expect(screen.getByRole("status")).toHaveTextContent("Polite");
  });
});

describe("ChatGate", () => {
  it("says how many free messages were used, quotes the draft and links to sign in", async () => {
    const onSignIn = vi.fn();
    renderWithMessages(
      <ChatGate
        freeMessages={2}
        draft="Which is nearest to a metro?"
        signInHref="/auth?redirect=/ai-search"
        onSignIn={onSignIn}
      />,
    );
    const region = screen.getByRole("region", { name: words.signInGateTitle });
    expect(within(region).getByText(/used your 2 free messages/)).toBeVisible();
    expect(within(region).getByText(words.gate.draftLabel)).toBeVisible();
    expect(within(region).getByText("Which is nearest to a metro?")).toBeVisible();
    const link = within(region).getByRole("link", { name: words.gate.signIn });
    expect(link).toHaveAttribute("href", "/auth?redirect=/ai-search");
    await userEvent.click(link);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("leaves the quote out when there is no draft, and takes focus when asked", () => {
    renderWithMessages(<ChatGate freeMessages={2} signInHref="#" focusHeading />);
    expect(screen.queryByText(words.gate.draftLabel)).toBeNull();
    expect(screen.getByRole("heading", { name: words.signInGateTitle })).toHaveFocus();
  });
});

const TARGET = { title: "3 BHK apartment", meta: "Velachery · ₹1.25 Cr" };
const ENQUIRY = {
  kind: "enquiry",
  target: TARGET,
  name: "Priya Raman",
  phone: "+91 98400 12345",
  message: "Is this still available?",
  privacyHref: "/privacy",
} as const;

describe("ChatConfirmCard", () => {
  it("shows exactly what will be sent and waits for Send", async () => {
    const onSend = vi.fn();
    renderWithMessages(<ChatConfirmCard {...ENQUIRY} onSend={onSend} />);
    const card = screen.getByRole("region", { name: words.confirm.enquiryTitle });
    expect(within(card).getByText(words.confirm.notSent)).toBeVisible();
    expect(within(card).getByText("3 BHK apartment")).toBeVisible();
    expect(within(card).getByText("Priya Raman")).toBeVisible();
    expect(within(card).getByText("+91 98400 12345")).toBeVisible();
    expect(within(card).getByText(words.confirm.verified)).toBeVisible();
    expect(within(card).getByText("Is this still available?")).toBeVisible();
    expect(within(card).getByText(enquiryWords.consent.text, { exact: false })).toBeVisible();
    expect(within(card).getByRole("link", { name: enquiryWords.consent.privacy })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(onSend).not.toHaveBeenCalled();
    await userEvent.click(within(card).getByRole("button", { name: enquiryWords.form.send }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("shows a site visit with its date and names the builder in the consent line", () => {
    renderWithMessages(
      <ChatConfirmCard
        kind="visit"
        target={{ title: "Kadal Vista", meta: "Kadal Homes" }}
        name="Priya Raman"
        phone="+91 98400 12345"
        visitDate="Sat, 14 Nov 2026"
        builderName="Kadal Homes"
        message="I'd like to see the show flat."
        privacyHref="/privacy"
      />,
    );
    expect(screen.getByRole("region", { name: words.confirm.visitTitle })).toBeVisible();
    expect(screen.getByText("Sat, 14 Nov 2026")).toBeVisible();
    expect(screen.getByText(/go to Kadal Homes and findsprop/)).toBeVisible();
    expect(screen.getByRole("button", { name: words.confirm.requestVisit })).toBeEnabled();
  });

  it("while sending, the button is busy and a second press does nothing", async () => {
    const onSend = vi.fn();
    renderWithMessages(<ChatConfirmCard {...ENQUIRY} state="sending" onSend={onSend} />);
    const send = screen.getByRole("button", { name: enquiryWords.form.send });
    expect(send).toHaveAttribute("aria-busy", "true");
    await userEvent.click(send);
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.queryByText(words.confirm.hint)).toBeNull();
  });

  it("a failed send puts the alert above the card and keeps the details", () => {
    renderWithMessages(<ChatConfirmCard {...ENQUIRY} problem="failed" />);
    expect(screen.getByRole("alert")).toHaveTextContent(enquiryWords.failed.title);
    expect(screen.getByText("Is this still available?")).toBeVisible();
    expect(screen.getByRole("button", { name: enquiryWords.form.send })).toBeEnabled();
  });

  it("too many enquiries today switches Send off", () => {
    renderWithMessages(<ChatConfirmCard {...ENQUIRY} problem="limited" />);
    expect(screen.getByRole("alert")).toHaveTextContent(enquiryWords.rateLimit.title);
    expect(screen.getByRole("button", { name: enquiryWords.form.send })).toBeDisabled();
  });

  it("sent is calm: a status, a link to the enquiries and no copper button", () => {
    renderWithMessages(
      <ChatConfirmCard {...ENQUIRY} state="sent" enquiriesHref="/dashboard/enquiries" />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(enquiryWords.sent.title);
    expect(screen.getByRole("link", { name: enquiryWords.sent.viewEnquiries })).toHaveAttribute(
      "href",
      "/dashboard/enquiries",
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("already contacted shows the alert and the target, and no card to send", () => {
    renderWithMessages(<ChatConfirmCard {...ENQUIRY} state="already" enquiriesHref="/e" />);
    expect(screen.getByRole("status")).toHaveTextContent(enquiryWords.already.title);
    expect(screen.getByText("3 BHK apartment")).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("signed out and session ended keep the message and offer to sign in", () => {
    const { unmount } = renderWithMessages(
      <ChatConfirmCard {...ENQUIRY} state="signed_out" signInHref="/auth" />,
    );
    expect(screen.getByRole("heading", { name: words.confirm.signedOutTitle })).toBeVisible();
    expect(screen.getByText("Is this still available?")).toBeVisible();
    expect(screen.getByRole("link", { name: words.confirm.signInToSend })).toHaveAttribute(
      "href",
      "/auth",
    );
    unmount();
    renderWithMessages(<ChatConfirmCard {...ENQUIRY} state="ended" signInHref="/auth" />);
    expect(screen.getByRole("heading", { name: messages.domain.sessionEnded.title })).toBeVisible();
    expect(screen.getByRole("link", { name: messages.domain.sessionEnded.action })).toHaveAttribute(
      "href",
      "/auth",
    );
  });

  it("takes focus to its heading when asked", () => {
    renderWithMessages(<ChatConfirmCard {...ENQUIRY} focusHeading />);
    expect(screen.getByRole("heading", { name: words.confirm.enquiryTitle })).toHaveFocus();
  });

  it("has at most one copper button in any state", () => {
    const states = [
      <ChatConfirmCard key="a" {...ENQUIRY} />,
      <ChatConfirmCard key="b" {...ENQUIRY} state="signed_out" signInHref="/a" />,
      <ChatConfirmCard key="c" {...ENQUIRY} state="sent" enquiriesHref="/e" />,
    ];
    for (const state of states) {
      const { container, unmount } = renderWithMessages(state);
      expect(container.querySelectorAll("[data-slot='button'].bg-cta").length).toBeLessThanOrEqual(
        1,
      );
      unmount();
    }
  });
});
