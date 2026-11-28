"use client";

import { useState } from "react";
import { AiCardsPage, AiCardsPageList } from "@/components/domain/ai-cards-page.client";
import { AiChatPager, type AiChatPane } from "@/components/domain/ai-chat-pager.client";
import { ChatAssistantMessage } from "@/components/domain/chat-assistant-message";
import { ChatCardsLine } from "@/components/domain/chat-cards-line.client";
import { ChatComposer } from "@/components/domain/chat-composer.client";
import { ChatThread } from "@/components/domain/chat-thread";
import { ChatUserBubble } from "@/components/domain/chat-user-bubble";
import { ProjectCard } from "@/components/domain/project-card";
import { Specimen } from "../frame";
import { InteractiveCard, RENT_PRIME, SALE_BUDGET, SALE_FEATURED } from "./domain-demos";
import { PROJECT_FEATURED, PROJECT_READY } from "./domain-demos-places";

/** A frame the height of a phone's screen between the header and the bottom bar: the pager is as tall as its box. */
const FRAME = "h-160 md:h-160 w-full max-w-sm rounded-xl border border-line bg-canvas";

const NOTHING = () => undefined;

function Cards() {
  return (
    <AiCardsPage
      pageKey="answer-1"
      order={0}
      renderPage={() => (
        <AiCardsPageList>
          {[
            <InteractiveCard key="a" property={SALE_FEATURED} layout="compact" />,
            <ProjectCard key="b" project={PROJECT_FEATURED} layout="compact" priority />,
            <InteractiveCard key="c" property={RENT_PRIME} layout="compact" />,
            <ProjectCard key="d" project={PROJECT_READY} layout="compact" priority />,
            <InteractiveCard key="e" property={SALE_BUDGET} layout="compact" />,
          ]}
        </AiCardsPageList>
      )}
      answers={{ count: 2, current: 0, onSelect: NOTHING }}
    />
  );
}

type LineMode = "swipe" | "see";

function Conversation({ onShow, mode }: { onShow: () => void; mode: LineMode }) {
  return (
    <div className="flex min-h-full flex-col gap-6 px-gutter py-6 lg:px-0">
      <ChatThread>
        <ChatUserBubble>Show me 2 and 3 BHK homes near OMR under 1.3 crore</ChatUserBubble>
        <ChatAssistantMessage answerId="answer-1">
          <p>Here are five that fit. The first two are the closest to OMR.</p>
          <div className="mt-3">
            <ChatCardsLine count={5} kind="properties" mode={mode} onShow={onShow} />
          </div>
        </ChatAssistantMessage>
      </ChatThread>
    </div>
  );
}

/** The pager the visitor can swipe (a touch screen, or the mouse dragging sideways) and the line and the back button drive. */
function Playground({ start = 0, mode = "swipe" }: { start?: AiChatPane; mode?: LineMode }) {
  const [pane, setPane] = useState<AiChatPane>(start);
  const [draft, setDraft] = useState("");
  return (
    <AiChatPager
      className={FRAME}
      pane={pane}
      onPaneChange={setPane}
      wide={false}
      cardsLabel="Homes and projects from the conversation"
      chat={<Conversation mode={mode} onShow={() => setPane(1)} />}
      cards={<Cards />}
      footer={
        <ChatComposer docked value={draft} onChange={setDraft} onSend={NOTHING} maxLength={2000} />
      }
    />
  );
}

export function AiChatPagerDemo() {
  return (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-10">
      <Specimen label="Below lg, the chat pane: the hint under the answer says to swipe (before the first swipe); swipe left or press the line to reach the cards; the message box stays under both panes">
        <Playground />
      </Specimen>
      <Specimen label="After the first swipe the line only says to see the cards (the visitor has learned to swipe)">
        <Playground mode="see" />
      </Specimen>
      <Specimen label="Below lg, the cards pane: the page of the answer last in view, with a way back to the chat (from lg the same two panes are columns and there is no back button)">
        <Playground start={1} />
      </Specimen>
    </div>
  );
}
