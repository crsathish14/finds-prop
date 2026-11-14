"use client";

/**
 * ChatComposer: the box where the visitor types a message to findsprop's AI assistant.
 * Purpose: an auto-growing text box, a Send button, the personal-details note and a character
 *   counter, with the sticky "dock" that keeps it above the bottom bar on phones. Owner: design
 *   system. It is controlled and sends nothing itself: the chat island holds the text, and calls the
 *   assistant when `onSend` runs. Enter sends and Shift+Enter adds a line (a proposal in the UX,
 *   to confirm); Enter never confirms a card.
 * Props: value, onChange (called with the new text), onSend (called when Send is pressed or Enter
 *   is pressed with text in the box), maxLength (the longest message; the page passes
 *   MAX_INPUT_CHARACTERS), busy (the assistant is working: Send is off and Enter sends nothing,
 *   but the box stays enabled so focus stays in it and the visitor can keep typing), disabled (a limit is
 *   reached or the gate is shown: the box and Send are off and the typed text is kept), disabledReason
 *   (already-translated text shown beside the note, tied to the box with aria-describedby, saying why it is off), sendTone ("accent" copper default |
 *   "primary" forest, used while a confirm card waits so the card's Send is the one copper button),
 *   docked (wraps the box in the sticky dock), id (the textarea's id, so the page can move focus to it
 *   after a prompt is chosen or the visitor returns from signing in), className.
 * Responsive: Send is a 48 px square with an icon only on phones, and shows the word "Send" from
 *   768 px. The dock sits directly above the bottom bar on phones and at the bottom of the screen
 *   from 768 px. The box grows with the text up to 10 rem.
 * Accessibility: the textarea has a visually hidden label; Send has an aria-label; the note is tied
 *   to the textarea with aria-describedby; the counter is not announced on every key. Send is off
 *   when the box is empty or busy or only spaces. A key press that is part of typing with an input method
 *   (composing) never sends.
 * States: empty (Send off), typing (Send on), disabled with the draft kept, near the limit (the
 *   counter turns to the danger colour at the limit).
 * Dependencies: Textarea, Button, Icon, Label, next-intl, cn.
 * Tests: chat-parts.test.tsx; Design Lab "AI chat composer".
 * UX reference: ai-chat (addendum batch 4, Composer, ComposerDock; addendum3.css .dock, .composer).
 */
import { SendHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  maxLength: number;
  disabled?: boolean;
  busy?: boolean;
  disabledReason?: string;
  sendTone?: "accent" | "primary";
  docked?: boolean;
  id?: string;
  className?: string;
};

function ChatComposer({
  value,
  onChange,
  onSend,
  maxLength,
  disabled = false,
  busy = false,
  disabledReason,
  sendTone = "accent",
  docked = false,
  id,
  className,
}: ChatComposerProps) {
  const translate = useTranslations("ai.composer");
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const noteId = useId();
  const reasonId = useId();
  const canSend = !disabled && !busy && value.trim().length > 0;

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (canSend) onSend();
  }

  const box = (
    <div
      data-slot="chat-composer"
      className={cn(
        "grid gap-2 rounded-xl border border-line-strong bg-surface p-3 shadow-card",
        disabled && "border-line bg-canvas-sunken shadow-none",
        className,
      )}
    >
      <div className="flex items-end gap-3">
        <Label htmlFor={fieldId} className="sr-only">
          {translate("label")}
        </Label>
        <Textarea
          id={fieldId}
          autoGrow
          rows={1}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          placeholder={translate("placeholder")}
          aria-describedby={disabledReason ? `${noteId} ${reasonId}` : noteId}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          className="max-h-40 min-h-13 flex-1 resize-none rounded-lg"
        />
        <Button
          type="button"
          variant={sendTone}
          disabled={!canSend}
          aria-label={translate("send")}
          onClick={onSend}
          iconStart={<Icon icon={SendHorizontal} />}
          className="w-13 px-0 md:w-auto md:px-6"
        >
          <span className="sr-only md:not-sr-only">{translate("send")}</span>
        </Button>
      </div>
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="flex-1 text-caption text-muted">
          <p id={noteId}>{translate("note")}</p>
          {disabledReason ? (
            <p id={reasonId} className="mt-1 font-semibold text-ink">
              {disabledReason}
            </p>
          ) : null}
        </div>
        <p
          className={cn(
            "text-caption whitespace-nowrap text-muted tabular-nums",
            value.length >= maxLength && "font-bold text-danger",
          )}
        >
          {translate("counter", { count: value.length, max: maxLength })}
        </p>
      </div>
    </div>
  );

  if (!docked) return box;
  return (
    <div className="sticky bottom-(--bottombar-h) z-sticky mt-2 border-t border-line bg-canvas py-3 md:bottom-0 md:pb-4">
      {box}
    </div>
  );
}

export { ChatComposer };
export type { ChatComposerProps };
