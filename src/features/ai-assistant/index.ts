/**
 * The admin AI assistant page (ADR-218, piece 7): the Web search switch, the estimated spend and credit from our own
 * records, and the questions most often answered from the web. Other modules import only this file.
 */
export { saveAiAssistant } from "./actions";
export { AiAssistantForm, type AiAssistantFormValues } from "./ai-assistant-form.client";
export { estimateCreditLeftUsd, estimateSpendUsd, type MonthUse } from "./estimate";
export { getAiAssistantOverview, type AiAssistantOverview, type WebAnswerRow } from "./queries";
export { aiAssistantInputSchema, CREDIT_BOUGHT_MAX_USD, type AiAssistantInput } from "./schemas";
export { WebAnswersTable } from "./web-answers-table";
