import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import messages from "@/i18n/messages/en.json";

/** Render a component with what the app layout provides: the text from en.json, and tooltips. */
export function renderWithMessages(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TooltipProvider>{ui}</TooltipProvider>
    </NextIntlClientProvider>,
  );
}
