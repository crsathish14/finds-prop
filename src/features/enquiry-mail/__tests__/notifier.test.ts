import { describe, expect, it } from "vitest";
import { createLogger } from "@/server/logger";
import {
  createFakeMailSender,
  DEFAULT_MAIL_TEMPLATES,
  type MailSender,
  type NotificationEvent,
} from "@/server/mail";
import type { EnquiryMailDeps } from "../deliver";
import { createEnquiryMailNotifier } from "../notifier";
import type { EnquiryMailFacts, EnquiryMailFinder } from "../types";

const FACTS: EnquiryMailFacts = {
  posterId: "poster-1",
  posterEmail: "owner@example.test",
  enquirerName: "Priya Raman",
  enquirerEmail: "priya@example.test",
  title: "Kadal Vista",
  pagePath: "/projects/kadal-vista",
  dashboardPath: "/builder/leads",
};

function setup(sender: MailSender = createFakeMailSender()) {
  const lines: string[] = [];
  const deps: EnquiryMailDeps = {
    sender,
    getTemplates: () => Promise.resolve({ ...DEFAULT_MAIL_TEMPLATES }),
    withinCap: () => Promise.resolve(true),
    siteName: "findsprop",
    absoluteUrl: (path) => `https://test.example${path}`,
    log: createLogger({}, { write: (line) => lines.push(line) }),
  };
  return { deps, lines, sender };
}

const LEAD: NotificationEvent = { kind: "project_lead.received", leadId: "lead-1" };

describe("UT-enquiry-mail-notifier: handing an event over (ADR-188)", () => {
  it("finds the facts for the event's id and sends the two mails", async () => {
    const { deps, sender } = setup();
    const asked: NotificationEvent[] = [];
    const find: EnquiryMailFinder = (event) => {
      asked.push(event);
      return Promise.resolve(FACTS);
    };
    await createEnquiryMailNotifier({ find, deps }).notify(LEAD);
    expect(asked).toEqual([LEAD]);
    expect((sender as ReturnType<typeof createFakeMailSender>).sent.map((mail) => mail.to)).toEqual(
      ["owner@example.test", "priya@example.test"],
    );
  });

  it("sends nothing when the finder knows nothing about the event (another kind, or a record that is gone)", async () => {
    const { deps, sender, lines } = setup();
    await createEnquiryMailNotifier({ find: () => Promise.resolve(null), deps }).notify({
      kind: "listing.approved",
      listingId: "l1",
      shortId: "abcd2345",
    });
    expect((sender as ReturnType<typeof createFakeMailSender>).sent).toEqual([]);
    expect(lines.join("\n")).toContain("nothing found for the event");
  });

  it("never throws when the read fails, and logs only the code", async () => {
    const { deps, lines } = setup();
    const find: EnquiryMailFinder = () =>
      Promise.reject(new Error("read failed for owner@example.test"));
    await expect(createEnquiryMailNotifier({ find, deps }).notify(LEAD)).resolves.toBeUndefined();
    expect(lines.join("\n")).toContain("enquiry mail failed");
    expect(lines.join("\n")).not.toContain("example.test");
  });

  it("never throws when the sender throws", async () => {
    const { deps } = setup(createFakeMailSender({ failWith: new Error("provider down") }));
    await expect(
      createEnquiryMailNotifier({ find: () => Promise.resolve(FACTS), deps }).notify(LEAD),
    ).resolves.toBeUndefined();
  });
});
