/**
 * The page every Design Lab board renders: title, links to the other boards, an index of the
 * entries, and the demo of each entry in its own section.
 */
import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { Heading } from "@/components/ui/heading";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { getBoard, LAB_BOARDS } from "./registry";
import type { LabBoardId } from "./types";

export function labBoardMetadata(id: LabBoardId): Metadata {
  return { title: `Design Lab: ${getBoard(id).title}`, robots: { index: false, follow: false } };
}

export function LabBoardPage({ board: id }: { board: LabBoardId }) {
  const board = getBoard(id);
  return (
    <Container as="main" id="main" className="flex flex-col gap-10 py-8">
      <header className="flex flex-col gap-4">
        <Text variant="overline">Design Lab · mirrors {board.uxBoard}</Text>
        <Heading as="h1" size="1">
          {board.title}
        </Heading>
        <Text tone="muted" className="max-w-[68ch]">
          {board.summary}
        </Text>
        <nav aria-label="Design Lab boards">
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {LAB_BOARDS.map((candidate) => (
              <li key={candidate.id}>
                <Link
                  href={`/design-system/${candidate.id}`}
                  variant="nav"
                  current={candidate.id === id}
                  className="py-2"
                >
                  {candidate.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="On this page">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-small">
            {board.entries.map((entry) => (
              <li key={entry.id}>
                <Link href={`#${entry.id}`} className="py-2 font-medium">
                  {entry.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      {board.entries.map((entry) => (
        <section
          key={entry.id}
          id={entry.id}
          aria-labelledby={`${entry.id}-title`}
          className="flex scroll-mt-6 flex-col gap-4"
        >
          <div className="flex flex-col gap-1 border-b border-line pb-3">
            <Heading as="h2" size="2" id={`${entry.id}-title`}>
              {entry.name}
            </Heading>
            <Text tone="muted" className="max-w-[68ch]">
              {entry.description}
            </Text>
            {entry.sources.length > 0 ? (
              <Text variant="caption" tone="muted">
                {entry.sources.map((source) => `components/${source}`).join(" · ")}
              </Text>
            ) : null}
          </div>
          <entry.Demo />
        </section>
      ))}
    </Container>
  );
}

export function LabIndexPage() {
  return (
    <Container as="main" id="main" className="flex flex-col gap-6 py-8">
      <Heading as="h1" size="1">
        Design Lab
      </Heading>
      <Text tone="muted">
        Development and review only (ADR-020). Each board mirrors one approved UX board and uses the
        real components.
      </Text>
      <ul className="flex flex-col gap-3">
        {LAB_BOARDS.map((board) => (
          <li key={board.id}>
            <Link href={`/design-system/${board.id}`} variant="arrow">
              {board.title}
            </Link>
            <Text variant="small" tone="muted">
              {board.summary}
            </Text>
          </li>
        ))}
      </ul>
    </Container>
  );
}
