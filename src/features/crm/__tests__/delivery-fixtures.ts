import { vi } from "vitest";
import { createLogger, type LogFields } from "@/server/logger";
import type { DeliveryDeps, DeliveryRecord, DeliveryStore, DueDelivery } from "../delivery";
import type { CrmConnection, CrmSecrets } from "../send";

export const SUBMISSION = "00000000-0000-4000-a000-000000000001";
export const INTEGRATION = "00000000-0000-4000-a000-0000000000a1";
export const PROJECT = "00000000-0000-4000-b000-0000000000a1";
export const NOW = Date.parse("2026-11-10T10:00:00.000Z");

export const DUE: DueDelivery = {
  submissionId: SUBMISSION,
  integrationId: INTEGRATION,
  attempt: 1,
  formName: "Enquiry form",
  projectId: PROJECT,
  projectName: "Kadal Vista",
  projectSlug: "kadal-vista",
  name: "Priya Raman",
  mobile: "9840012345",
  email: "priya@example.test",
  data: { message: "Interested in a 3 BHK", budget: 8500000, tags: ["east", "park"], agree: true },
  source: "/projects/kadal-vista",
  createdAt: "2026-11-10T09:58:00.000Z",
};

export const CONNECTION: CrmConnection = {
  // An address written out as an IP number needs no name lookup, so no test touches the network.
  baseUrl: "https://93.184.216.34",
  endpoint: "/v2/leads",
  method: "POST",
  leadSource: "Find Prop",
  leadIdPath: "data.lead.id",
  headers: { "X-Api-Key": "{{api_key}}" },
  bodyMapping: {
    fullName: "{{name}}",
    phone: "{{mobile}}",
    note: "{{message}}",
    project: "{{project_code}}",
    form: "{{form_name}}",
  },
};
export const SECRETS: CrmSecrets = {
  apiKey: "fake-key-for-tests",
  apiSecret: null,
  accessToken: null,
};

type Found = Awaited<ReturnType<DeliveryStore["readConnection"]>>;

export interface FakeOptions {
  due?: DueDelivery[];
  connection?: Found | "throws";
  token?: string | null;
  waiting?: boolean;
  /** Submission ids whose result cannot be recorded. */
  recordFails?: string[];
  armFails?: boolean;
  disarmFails?: boolean;
  claimFails?: boolean;
  /** Called while a delivery is being sent, to watch how many run together. */
  onSend?: () => Promise<void> | void;
}

export function fakeStore(options: FakeOptions = {}) {
  const calls: string[] = [];
  const recorded: DeliveryRecord[] = [];
  const found: Found =
    options.connection === undefined || options.connection === "throws"
      ? {
          name: "Sample CRM",
          connection: CONNECTION,
          secrets: SECRETS,
          projectCodes: { [PROJECT]: "KV-01" },
        }
      : options.connection;
  const store: DeliveryStore = {
    claim: async (limit, submissionId) => {
      calls.push(`claim:${limit}:${submissionId ?? "any"}`);
      if (options.claimFails) throw new Error("claim failed");
      return options.due ?? [];
    },
    readConnection: async (integrationId) => {
      calls.push(`read:${integrationId}`);
      if (options.connection === "throws") throw new Error("read failed");
      await options.onSend?.();
      return found;
    },
    record: async (entry) => {
      calls.push(`record:${entry.submissionId}`);
      if (options.recordFails?.includes(entry.submissionId)) throw new Error("record failed");
      recorded.push(entry);
    },
    readToken: async () => (options.token === undefined ? null : options.token),
    hasWaiting: async () => {
      calls.push("hasWaiting");
      return options.waiting ?? false;
    },
    armRetryJob: async () => {
      calls.push("arm");
      if (options.armFails) throw new Error("not configured");
    },
    disarmRetryJob: async () => {
      calls.push("disarm");
      if (options.disarmFails) throw new Error("disarm failed");
    },
  };
  return { store, calls, recorded };
}

export function logCollector() {
  const lines: { level: string; message: string; fields: LogFields }[] = [];
  const log = createLogger(
    {},
    {
      level: "debug",
      write: (line) => {
        const parsed = JSON.parse(line) as { level: string; message: string } & LogFields;
        lines.push({ level: parsed.level, message: parsed.message, fields: parsed });
      },
    },
  );
  return { log, lines };
}

export type Sent = { url: string; method: string | undefined; headers: Headers; body: string };

/** A stand-in for `fetch` that answers the same every time and remembers what it was sent. */
export function fakeFetch(status = 200, body: unknown = { data: { lead: { id: "CRM-4821" } } }) {
  const sent: Sent[] = [];
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({
      url: String(url),
      method: init?.method,
      headers: init?.headers as Headers,
      body: String(init?.body),
    });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fetcher, sent };
}

export function depsWith(fetcher: typeof fetch, log = logCollector().log): DeliveryDeps {
  return { fetch: fetcher, log, now: () => NOW };
}
