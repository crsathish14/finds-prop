import type { LabEntry } from "../types";
import {
  CrmConnectionCardsDemo,
  CrmConnectionFieldsDemo,
  CrmLogsTableDemo,
  CrmRowsEditorDemo,
  CrmSubmissionPartsDemo,
} from "./crm-demos";

/**
 * What the admin uses to connect the site to a CRM (S7-T09, FR-ADM-09): the connection cards, the API logs, the
 * editor's Connection and Credentials boxes, the lists of headers, body mapping and project codes, and the two
 * additions to the Leads page (the Agent column and Retry delivery now). It has its own board because the Admin board
 * had grown too tall to photograph within the time limit at 820 and 1440 px (as the Site content, Sponsors and Forms
 * boards did). It mirrors the admin CRM screen.
 */
export const CRM: LabEntry[] = [
  {
    id: "crm-connections",
    name: "CRM connection cards",
    description:
      "The heading, the New connection button and the cards of the admin's CRM page: each connection with its name and state (Active or Inactive), where it sends, whether the API key, API secret and access token are set (never their values), and Test API, Edit and Delete. Shown with the page's tabs, two connections and a test that worked, a test that failed, a test running with a very long name and address, and nothing yet.",
    sources: ["domain/crm-connections.tsx"],
    Demo: CrmConnectionCardsDemo,
  },
  {
    id: "crm-logs-table",
    name: "CRM logs table",
    description:
      "The API logs tab of the CRM page: one line for each call to a CRM, newest first, with the time, the CRM, the form, whether it worked, the HTTP status, the number of the attempt and the start of the answer, and Retry on a failed delivery that can still be sent again. A table from 1024 px of room and cards below that. Shown with three deliveries, a retry running, a call with no answer, an older failure with no Retry, a test call, a very long answer, and nothing yet.",
    sources: ["domain/crm-logs-table.tsx"],
    Demo: CrmLogsTableDemo,
  },
  {
    id: "crm-connection-fields",
    name: "CRM connection fields",
    description:
      "The Connection box and the Credentials boxes of the CRM editor: name, lead source, base URL with its hint, endpoint, HTTP method, lead ID path and the Active switch; and each secret as a box of dots with Replace and Clear (or a password box when nothing is saved). Shown filled in, with an address that is not allowed, while saving, and with a secret kept, replaced, to be cleared, with an error, and not saved.",
    sources: ["domain/crm-connection-fields.tsx"],
    Demo: CrmConnectionFieldsDemo,
  },
  {
    id: "crm-rows-editor",
    name: "CRM rows editor",
    description:
      "A list the admin adds to and removes from, used three times in the Headers and body box of the CRM editor: header names and values, body mapping (a CRM field and a template with the form's field keys), and project codes (a project from a list and the CRM's code). Shown with rows, with nothing added, with a repeated name and a missing value, and while saving.",
    sources: ["domain/crm-rows-editor.tsx"],
    Demo: CrmRowsEditorDemo,
  },
  {
    id: "crm-submission-parts",
    name: "Submissions with Agent and Retry",
    description:
      "The two additions to the admin's Leads page (S7-T09): the Agent column in the Form submissions list (the CRM connection that took each submission), and Retry delivery now under a failed delivery in the submission's details. Shown with the column, with the button, without it, and while it retries.",
    sources: ["domain/submissions-table.tsx", "domain/submission-detail.tsx"],
    Demo: CrmSubmissionPartsDemo,
  },
];
