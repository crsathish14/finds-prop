/**
 * ChatNoteLine: one fixed sentence under a chat message, such as the cap note, the disclaimer or
 * "I removed personal details from your message".
 * Purpose: a quiet panel with an info icon for the assistant's fixed notes, so they are not mistaken
 *   for the model's own words. Owner: design system. The sentence comes from en.json under `ai` and
 *   is passed in already translated.
 * Props: children (the sentence), align ("start" default under an assistant message | "user" under
 *   the visitor's bubble, right-aligned), live (the note announces itself politely when it appears,
 *   as the personal-details notice does), className.
 * Responsive: at most 68 characters wide; the user-aligned note is at most 88% of the column.
 * Accessibility: role="note", or role="status" when live. The icon is decoration: the sentence says
 *   it in words (R-DS-09).
 * States: default; user-aligned; live.
 * Dependencies: Icon, cn.
 * Tests: chat-parts.test.tsx; Design Lab "AI chat messages".
 * UX reference: ai-chat (addendum batch 4, NoteLine; addendum3.css .ai-note).
 */
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type ChatNoteLineProps = {
  children: ReactNode;
  align?: "start" | "user";
  live?: boolean;
  className?: string;
};

function ChatNoteLine({ children, align = "start", live = false, className }: ChatNoteLineProps) {
  return (
    <div
      data-slot="chat-note-line"
      role={live ? "status" : "note"}
      className={cn(
        "flex max-w-[68ch] items-start gap-2 rounded-md bg-canvas-sunken p-3 text-small font-medium text-ink",
        align === "user" && "max-w-[88%] self-end md:max-w-160",
        className,
      )}
    >
      <Icon icon={Info} className="mt-px text-primary" />
      <span>{children}</span>
    </div>
  );
}

export { ChatNoteLine };
export type { ChatNoteLineProps };
