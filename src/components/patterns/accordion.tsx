/**
 * Accordion: a list of questions or headings that each open to show their answer.
 * Purpose: the FAQ page and any later page that hides detail under a heading (ADR-143). Built on the browser's own
 *   details and summary elements, so it works without scripts, the answers are always in the page (a search engine and
 *   the browser's find read them), and the keyboard and screen reader behaviour is the browser's. Owner: design system.
 *   Several items may be open at once, so a reader can compare two answers. It holds no words and no state: the page
 *   passes the words, already translated, and may open an item with the `open` prop or by setting `open` on its
 *   element (the FAQ opens the question an address names).
 * Props: Accordion (a plain container, className), AccordionItem (open: start open; id for an anchor; native details
 *   props), AccordionTrigger (children: the question; it is a level-3 heading inside the summary, so a page puts its
 *   groups under level-2 headings), AccordionContent (children: the answer).
 * Responsive: full width; the question wraps and the arrow stays at the end; the target is at least 44 px tall.
 * Accessibility: the summary is a button that announces expanded or collapsed; Enter and Space open and close it;
 *   Tab moves between questions; the arrow is drawn, not read. The heading inside the summary keeps the page outline.
 * States: closed, open, hover, focus. Dependencies: Icon, cn. Tests: accordion.test.tsx; Design Lab "Discovery"
 *   (FAQ accordion, ADR-143).
 * UX reference: none approved yet; drawn in the Design Lab for the owner to approve (ADR-143).
 */
import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

function Accordion({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="accordion" className={cn("flex flex-col", className)} {...props} />;
}

function AccordionItem({ className, ...props }: ComponentProps<"details">) {
  return (
    <details
      data-slot="accordion-item"
      className={cn("group scroll-mt-24 border-b border-line last:border-b-0", className)}
      {...props}
    />
  );
}

function AccordionTrigger({ className, children, ...props }: ComponentProps<"summary">) {
  return (
    <summary
      data-slot="accordion-trigger"
      className={cn(
        "flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-xs py-4 text-start [&::-webkit-details-marker]:hidden",
        "text-title-sm font-semibold text-ink transition-colors duration-(--dur-fast) hover:text-primary",
        "outline-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-primary",
        className,
      )}
      {...props}
    >
      <h3 className="min-w-0 text-[length:inherit] font-[inherit] [overflow-wrap:anywhere]">
        {children}
      </h3>
      <Icon
        icon={ChevronDown}
        className="shrink-0 text-muted transition-transform duration-(--dur-fast) group-open:rotate-180"
      />
    </summary>
  );
}

function AccordionContent({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="accordion-content"
      className={cn("flex flex-col gap-3 pb-5 text-body text-muted", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
