import type { MailTemplate, MailTemplateKind } from "@/lib/mail-template";

/** What the editor opens on for one mail (ADR-183). Plain data, so it crosses from the server to the form as it is. */
export interface MailTemplateEditPage {
  kind: MailTemplateKind;
  /** The wording to edit: the working copy if there is one, else the published wording, else the wording in code. */
  template: MailTemplate;
  /** True when a working copy exists: it has been saved but not published. */
  hasUnpublishedChanges: boolean;
  /** The live version's day, or null when the mail still uses the wording in code. */
  published: { updated: string | null } | null;
}
