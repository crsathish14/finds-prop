/**
 * Filling in the wording of an enquiry mail (ADR-183). The function itself is pure and lives in `src/lib` so the admin
 * screen can run the same code for its preview (a browser island may not import `server/`); the mail code reaches it
 * from here. It sends nothing and reads nothing: the caller finds the template and the values and hands the result to
 * a `MailSender`.
 */
export {
  DEFAULT_MAIL_TEMPLATES,
  renderMailTemplate,
  type MailTemplate,
  type MailTemplateKind,
  type MailTemplateValues,
  type RenderedMail,
} from "@/lib/mail-template";
