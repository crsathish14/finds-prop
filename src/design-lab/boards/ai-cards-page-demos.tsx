"use client";

import { useState, type ReactNode } from "react";
import { AiCardsPage, AiCardsPageList } from "@/components/domain/ai-cards-page.client";
import { ChatAssistantMessage } from "@/components/domain/chat-assistant-message";
import { ChatCardsLine } from "@/components/domain/chat-cards-line.client";
import { ChatThread } from "@/components/domain/chat-thread";
import { ChatUserBubble } from "@/components/domain/chat-user-bubble";
import { ProjectCard } from "@/components/domain/project-card";
import { Specimen } from "../frame";
import { InteractiveCard, RENT_PRIME, SALE_BUDGET, SALE_FEATURED } from "./domain-demos";
import { PROJECT_FEATURED, PROJECT_LAUNCH, PROJECT_READY } from "./domain-demos-places";

/** The cards of each page of the demo conversation, by page key: three answers, the third with a Show more page. */
function cardsOf(key: string): ReactNode[] {
  switch (key) {
    case "answer-1":
      return [
        <InteractiveCard key="a" property={SALE_FEATURED} layout="compact" />,
        <ProjectCard key="b" project={PROJECT_FEATURED} layout="compact" priority />,
        <InteractiveCard key="c" property={RENT_PRIME} layout="compact" />,
        <ProjectCard key="d" project={PROJECT_LAUNCH} layout="compact" priority />,
        <InteractiveCard key="e" property={SALE_BUDGET} layout="compact" />,
        <ProjectCard key="f" project={PROJECT_READY} layout="compact" priority />,
      ];
    case "answer-2":
      return [
        <InteractiveCard key="a" property={RENT_PRIME} layout="compact" />,
        <InteractiveCard key="b" property={SALE_BUDGET} layout="compact" />,
      ];
    case "answer-3-page-1":
      return [
        <ProjectCard key="a" project={PROJECT_READY} layout="compact" priority />,
        <ProjectCard key="b" project={PROJECT_LAUNCH} layout="compact" priority />,
        <ProjectCard key="c" project={PROJECT_FEATURED} layout="compact" priority />,
      ];
    default:
      return [
        <InteractiveCard key="a" property={SALE_FEATURED} layout="compact" />,
        <InteractiveCard key="b" property={SALE_BUDGET} layout="compact" />,
      ];
  }
}

/** Every page, in the order of the conversation: the key and the answer and page it belongs to. */
const PAGES = [
  { key: "answer-1", answer: 0, page: 0 },
  { key: "answer-2", answer: 1, page: 0 },
  { key: "answer-3-page-1", answer: 2, page: 0 },
  { key: "answer-3-page-2", answer: 2, page: 1 },
] as const;

function renderPage(key: string) {
  return <AiCardsPageList>{cardsOf(key)}</AiCardsPageList>;
}

/** The cards page with its indicators; press a dot or a number to see the slide-and-fade. */
function Playground({ start = 0 }: { start?: number }) {
  const [index, setIndex] = useState(start);
  const current = PAGES[index] ?? PAGES[0];
  const pagesOfAnswer = PAGES.filter((page) => page.answer === current.answer);
  const go = (answer: number, page: number) => {
    const next = PAGES.findIndex((entry) => entry.answer === answer && entry.page === page);
    if (next !== -1) setIndex(next);
  };
  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <div className="h-160 rounded-xl border border-line bg-canvas p-3">
        <AiCardsPage
          pageKey={current.key}
          order={index}
          renderPage={renderPage}
          answers={{ count: 3, current: current.answer, onSelect: (answer) => go(answer, 0) }}
          pages={{
            count: pagesOfAnswer.length,
            current: current.page,
            onSelect: (page) => go(current.answer, page),
          }}
        />
      </div>
    </div>
  );
}

/** The chat with the cards page beside it, as at lg and up: text and one line in the chat, the cards on the right. */
function BesideTheChat() {
  return (
    <div className="flex w-full flex-col gap-6 lg:flex-row lg:gap-10">
      <div className="min-w-0 lg:w-128 lg:flex-none xl:w-144">
        <ChatThread>
          <ChatUserBubble>Show me 2 and 3 BHK homes near OMR under 1.3 crore</ChatUserBubble>
          <ChatAssistantMessage answerId="answer-1">
            <p>Here are six that fit. The first two are the closest to OMR.</p>
            <div className="mt-3">
              <ChatCardsLine count={6} kind="properties" onShow={() => undefined} />
            </div>
          </ChatAssistantMessage>
          <ChatUserBubble>Any with a swimming pool?</ChatUserBubble>
          <ChatAssistantMessage answerId="answer-2">
            <p>Two of them have a pool. I have put them on the right.</p>
            <div className="mt-3">
              <ChatCardsLine count={2} kind="homes" onShow={() => undefined} />
            </div>
          </ChatAssistantMessage>
        </ChatThread>
      </div>
      <div className="h-160 min-w-0 flex-1 rounded-xl border border-line bg-canvas p-3">
        <AiCardsPage
          pageKey="answer-2"
          order={1}
          renderPage={renderPage}
          answers={{ count: 2, current: 1, onSelect: () => undefined }}
        />
      </div>
    </div>
  );
}

export function AiCardsPageDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Beside the chat, from lg: the answers keep their words and one line, the cards of the answer being read are on the right">
        <BesideTheChat />
      </Specimen>
      <Specimen label="Six cards of the first answer, on one screen with no scrolling; press a dot to move to another answer (a newer one slides in from below, an older one from above)">
        <Playground />
      </Specimen>
      <Specimen label="The third answer has a second page from Show more: press 2 for the page turn">
        <Playground start={2} />
      </Specimen>
      <Specimen label="One answer only: no dots, no numbers">
        <div className="h-96 w-full max-w-md rounded-xl border border-line bg-canvas p-3">
          <AiCardsPage
            pageKey="answer-2"
            order={0}
            renderPage={renderPage}
            answers={{ count: 1, current: 0, onSelect: () => undefined }}
          />
        </div>
      </Specimen>
    </div>
  );
}
