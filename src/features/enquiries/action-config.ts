import { sendEnquirySchema, type SendEnquiryInput } from "./schemas";

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
