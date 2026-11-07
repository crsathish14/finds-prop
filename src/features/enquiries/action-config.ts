import { sendEnquirySchema, setEnquiryStatusSchema, type SendEnquiryInput } from "./schemas";

/**
 * How the enquiry action runs, kept apart from the "use server" file so a test can build it. Sending an
 * enquiry needs a signed-in visitor with a verified phone (the owner's rule for anything that asks a
 * person to get in touch). It is limited to 10 per user per day with a friendly "please wait" (BR-70,
 * DEC-33), and a one-time key stops a double click or a retry from storing two (R-BE-05). The database
 * function adds the rule of one enquiry per user per home per 24 hours (DEC-26).
 */
export const sendEnquiryConfig = {
  name: "sendEnquiry",
  input: sendEnquirySchema,
  auth: "verified-phone" as const,
  rateLimit: { scope: "enquiry" as const },
  idempotencyKey: (input: SendEnquiryInput) => input.idempotencyKey,
};

/**
 * The owner moves an enquiry on their listing to Contacted or Closed (S6-T03). It needs a signed-in account
 * with a verified phone, like everything an owner does on the dashboard. No rate limit and no key: each
 * enquiry can move forward at most twice, so the work is bounded by the enquiries that exist, and a repeated
 * call finds the enquiry already moved. Enquiries are private, so no public page is refreshed and the
 * database triggers write no audit entry for them.
 */
export const setEnquiryStatusConfig = {
  name: "setEnquiryStatus",
  input: setEnquiryStatusSchema,
  auth: "verified-phone" as const,
};
