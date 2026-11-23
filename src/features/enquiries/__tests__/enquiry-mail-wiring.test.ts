import { describe, expect, it } from "vitest";
import { createEnquiryMailNotifier } from "@/features/enquiry-mail/notifier";
import type { EnquiryMailFacts } from "@/features/enquiry-mail";
import {
  createDefineAction,
  type ActionDeps,
  type SessionView,
} from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { createLogger } from "@/server/logger";
import {
  createFakeMailSender,
  DEFAULT_MAIL_TEMPLATES,
  type NotificationEvent,
} from "@/server/mail";
import { sendEnquiryConfig } from "../action-config";
import { submitEnquiry, type EnquiryWriteStore } from "../enquiry-service";

const KEY = "00000000-0000-4000-8000-000000000001";
const CUSTOMER: SessionView = {
  userId: "user-1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};

const FACTS: EnquiryMailFacts = {
  posterId: "owner-1",
  posterEmail: "owner@example.test",
  enquirerName: "Priya Raman",
  enquirerEmail: "priya@example.test",
  title: "2 BHK apartment in Adyar",
  pagePath: "/properties/two-bhk-adyar-k3x9a2bd",
  dashboardPath: "/dashboard?tab=received",
};

const enquiry = (overrides: Record<string, unknown> = {}) => ({
  shortId: "k3x9a2bd",
  name: "Priya Raman",
  phone: "98400 12345",
  idempotencyKey: KEY,
  ...overrides,
});

/**
 * The action as `actions.ts` builds it: store the enquiry, then hand the new id to the mail notifier. `after()` is
 * replaced by a list of the promises it would run, so a test can wait for them.
 */
function harness(
  options: {
    insert?: () => Promise<string>;
    sendFails?: boolean;
    hookFails?: boolean;
    replay?: unknown;
  } = {},
) {
  const sender = createFakeMailSender(
    options.sendFails ? { failWith: new Error("provider down") } : {},
  );
  const events: NotificationEvent[] = [];
  const scheduled: Array<Promise<void>> = [];
  const lines: string[] = [];
  const notifier = createEnquiryMailNotifier({
    find: (event) => {
      events.push(event);
      return Promise.resolve(FACTS);
    },
    deps: {
      sender,
      getTemplates: () => Promise.resolve({ ...DEFAULT_MAIL_TEMPLATES }),
      withinCap: () => Promise.resolve(true),
      siteName: "findsprop",
      absoluteUrl: (path) => `https://test.example${path}`,
      log: createLogger({}, { write: (line) => lines.push(line) }),
    },
  });
  const store: EnquiryWriteStore = {
    insertEnquiry: options.insert ?? (() => Promise.resolve("enquiry-1")),
  };
  const deps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => Promise.resolve(CUSTOMER),
    rateLimit: () => Promise.resolve(),
    beginIdempotent: () =>
      Promise.resolve(
        options.replay === undefined
          ? { replay: false as const }
          : { replay: true as const, result: options.replay },
      ),
    completeIdempotent: () => Promise.resolve(),
    releaseIdempotent: () => Promise.resolve(),
    invalidate: () => undefined,
    audit: () => Promise.resolve(),
    log: createLogger({}, { write: () => undefined }),
  };
  const send = createDefineAction(deps)({
    ...sendEnquiryConfig,
    handler: async ({ input, session }) => {
      await submitEnquiry(store, {
        input,
        userId: session?.userId ?? "",
        onStored: (storedId) => {
          if (options.hookFails) throw new Error("after() is not available");
          scheduled.push(notifier.notify({ kind: "enquiry.received", enquiryId: storedId }));
        },
      });
      return { received: true as const };
    },
  });
  return { send, sender, events, scheduled, lines };
}

describe("UT-enquiry-mail-wiring: sendEnquiry hands the stored enquiry to the mail (ADR-188)", () => {
  it("hands over the id only, and the fake sender receives exactly the poster mail and the confirmation", async () => {
    const { send, sender, events, scheduled } = harness();
    expect(
      await send(enquiry({ email: "priya@example.test", message: "Is it available?" })),
    ).toEqual({ ok: true, data: { received: true } });
    await Promise.all(scheduled);
    expect(events).toEqual([{ kind: "enquiry.received", enquiryId: "enquiry-1" }]);
    expect(sender.sent.map((mail) => [mail.to, mail.subject])).toEqual([
      ["owner@example.test", "You got an enquiry from Priya Raman"],
      ["priya@example.test", "We sent your enquiry about 2 BHK apartment in Adyar"],
    ]);
    const everything = sender.sent.map((mail) => `${mail.subject}\n${mail.text}`).join("\n");
    expect(everything).not.toContain("9840012345");
    expect(everything).not.toContain("Is it available?");
  });

  it.each([
    ["a duplicate within 24 hours", new ActionError("CONFLICT", "duplicate")],
    ["a home nobody can see", new ActionError("NOT_FOUND", "not open")],
    ["the owner's own home", new ActionError("FORBIDDEN", "own listing")],
    ["a value the database refuses", new ActionError("VALIDATION", "refused")],
  ])("sends no mail for %s", async (_name, failure) => {
    const { send, sender, events, scheduled } = harness({ insert: () => Promise.reject(failure) });
    expect(await send(enquiry())).toMatchObject({ ok: false });
    await Promise.all(scheduled);
    expect(scheduled).toEqual([]);
    expect(events).toEqual([]);
    expect(sender.sent).toEqual([]);
  });

  it("sends no second mail when the same form is sent again (the first answer is replayed)", async () => {
    const first = { ok: true, data: { received: true } };
    const { send, sender, scheduled } = harness({ replay: first });
    expect(await send(enquiry())).toEqual(first);
    expect(scheduled).toEqual([]);
    expect(sender.sent).toEqual([]);
  });

  it("still answers that the enquiry was received when the sender throws", async () => {
    const { send, scheduled, lines } = harness({ sendFails: true });
    expect(await send(enquiry())).toEqual({ ok: true, data: { received: true } });
    await expect(Promise.all(scheduled)).resolves.toBeDefined();
    expect(lines.filter((line) => line.includes("enquiry mail not sent"))).toHaveLength(2);
  });

  it("still answers that the enquiry was received when handing it over throws", async () => {
    const { send, sender } = harness({ hookFails: true });
    expect(await send(enquiry())).toEqual({ ok: true, data: { received: true } });
    expect(sender.sent).toEqual([]);
  });
});
