import { describe, expect, it } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { createLogger } from "@/server/logger";
import {
  createFakeMailSender,
  DEFAULT_MAIL_TEMPLATES,
  type MailSender,
  type MailTemplate,
  type MailTemplateKind,
} from "@/server/mail";
import { deliverEnquiryMails, UNTITLED_HOME, type EnquiryMailDeps } from "../deliver";
import type { EnquiryMailFacts } from "../types";

const FACTS: EnquiryMailFacts = {
  posterId: "poster-1",
  posterEmail: "owner@example.test",
  enquirerName: "Priya Raman",
  enquirerEmail: "priya@example.test",
  title: "2 BHK apartment in Adyar",
  pagePath: "/properties/two-bhk-adyar-k3x9a2bd",
  dashboardPath: "/dashboard?tab=received",
};

function harness(
  options: {
    sender?: MailSender;
    withinCap?: () => Promise<boolean>;
    templates?: () => Promise<Record<MailTemplateKind, MailTemplate>>;
  } = {},
) {
  const sender = options.sender ?? createFakeMailSender();
  const lines: string[] = [];
  const capKeys: string[] = [];
  const deps: EnquiryMailDeps = {
    sender,
    getTemplates: options.templates ?? (() => Promise.resolve({ ...DEFAULT_MAIL_TEMPLATES })),
    withinCap: (posterId) => {
      capKeys.push(posterId);
      return options.withinCap ? options.withinCap() : Promise.resolve(true);
    },
    siteName: "findsprop",
    absoluteUrl: (path) => `https://test.example${path}`,
    log: createLogger({}, { write: (line) => lines.push(line) }),
  };
  return { deps, sender, lines, capKeys };
}

const sentOf = (sender: MailSender) => (sender as ReturnType<typeof createFakeMailSender>).sent;

describe("UT-enquiry-mail: which mails an enquiry sends (ADR-188)", () => {
  it("sends the poster one mail and the enquirer one confirmation, with the published wording filled in", async () => {
    const { deps, sender } = harness();
    expect(await deliverEnquiryMails(FACTS, deps)).toEqual({ sent: ["poster", "sender"] });
    expect(sentOf(sender)).toEqual([
      {
        to: "owner@example.test",
        subject: "You got an enquiry from Priya Raman",
        text: [
          "Hello,",
          "",
          "Someone named Priya Raman sent an enquiry about 2 BHK apartment in Adyar on findsprop.",
          "",
          "Open your dashboard to see it:",
          "https://test.example/dashboard?tab=received",
          "",
          "The page they asked about:",
          "https://test.example/properties/two-bhk-adyar-k3x9a2bd",
        ].join("\n"),
      },
      {
        to: "priya@example.test",
        subject: "We sent your enquiry about 2 BHK apartment in Adyar",
        text: [
          "Hello Priya Raman,",
          "",
          "We have passed your enquiry about 2 BHK apartment in Adyar on to the owner.",
          "",
          "You can look at it again here:",
          "https://test.example/properties/two-bhk-adyar-k3x9a2bd",
          "",
          "findsprop",
        ].join("\n"),
      },
    ]);
  });

  it("uses the wording the admin published, not the wording in code", async () => {
    const { deps, sender } = harness({
      templates: () =>
        Promise.resolve({
          enquiry_poster: {
            subject: "New: {enquirerName}",
            body: "{enquirerName} wrote. {dashboardLink}",
          },
          enquiry_sender: { subject: "Sent", body: "Thanks {enquirerName}. {propertyTitle}" },
        }),
    });
    await deliverEnquiryMails(FACTS, deps);
    expect(sentOf(sender).map((mail) => [mail.subject, mail.text])).toEqual([
      ["New: Priya Raman", "Priya Raman wrote. https://test.example/dashboard?tab=received"],
      ["Sent", "Thanks Priya Raman. 2 BHK apartment in Adyar"],
    ]);
  });

  it("sends no confirmation when the enquirer typed no email", async () => {
    const { deps, sender } = harness();
    expect(await deliverEnquiryMails({ ...FACTS, enquirerEmail: null }, deps)).toEqual({
      sent: ["poster"],
    });
    expect(sentOf(sender).map((mail) => mail.to)).toEqual(["owner@example.test"]);
  });

  it("sends only the confirmation when the poster has no email on file", async () => {
    const { deps, sender, lines } = harness();
    expect(await deliverEnquiryMails({ ...FACTS, posterEmail: null }, deps)).toEqual({
      sent: ["sender"],
    });
    expect(sentOf(sender).map((mail) => mail.to)).toEqual(["priya@example.test"]);
    expect(lines.join("\n")).toContain("the poster has no email on file");
  });

  it("sends nothing and counts nothing when there is no address at all", async () => {
    const { deps, sender, capKeys } = harness();
    expect(
      await deliverEnquiryMails({ ...FACTS, posterEmail: null, enquirerEmail: null }, deps),
    ).toEqual({ skipped: "no-address" });
    expect(sentOf(sender)).toEqual([]);
    expect(capKeys).toEqual([]);
  });

  it("names a home with no title in words, never leaving a gap", async () => {
    const { deps, sender } = harness();
    await deliverEnquiryMails({ ...FACTS, title: null }, deps);
    expect(sentOf(sender)[0]?.text).toContain(`about ${UNTITLED_HOME} on findsprop`);
    expect(sentOf(sender)[1]?.subject).toBe(`We sent your enquiry about ${UNTITLED_HOME}`);
  });

  it("keeps a name with a line break in it on one line of the subject", async () => {
    const { deps, sender } = harness();
    await deliverEnquiryMails(
      { ...FACTS, enquirerName: "Priya\r\nBcc: someone@example.test" },
      deps,
    );
    const subject = sentOf(sender)[0]?.subject ?? "";
    expect(subject).not.toMatch(/[\r\n]/u);
    expect(subject).toBe("You got an enquiry from Priya Bcc: someone@example.test");
  });
});

describe("UT-enquiry-mail: the poster's daily cap (ADR-188)", () => {
  it("counts one notification against the poster, not the enquirer", async () => {
    const { deps, capKeys } = harness();
    await deliverEnquiryMails(FACTS, deps);
    expect(capKeys).toEqual(["poster-1"]);
  });

  it("sends neither mail once the cap is used up, and says so", async () => {
    const { deps, sender, lines } = harness({ withinCap: () => Promise.resolve(false) });
    expect(await deliverEnquiryMails(FACTS, deps)).toEqual({ skipped: "cap" });
    expect(sentOf(sender)).toEqual([]);
    expect(lines.join("\n")).toContain("daily cap is used up");
  });

  it("sends nothing when the cap cannot be counted (fail closed), and logs only the code", async () => {
    const { deps, sender, lines } = harness({
      withinCap: () =>
        Promise.reject(new ActionError("INTERNAL", "counter said owner@example.test")),
    });
    expect(await deliverEnquiryMails(FACTS, deps)).toEqual({ skipped: "cap-unavailable" });
    expect(sentOf(sender)).toEqual([]);
    expect(lines.join("\n")).toContain('"errorCode":"INTERNAL"');
    expect(lines.join("\n")).not.toContain("owner@example.test");
  });
});

describe("UT-enquiry-mail: failures never reach the enquiry (ADR-188)", () => {
  it("logs a poster mail that fails and still sends the confirmation", async () => {
    const sent: string[] = [];
    const sender: MailSender = {
      send: ({ to }) => {
        if (to === "owner@example.test") {
          return Promise.reject(
            new ActionError("UPSTREAM_FAILED", "Resend answered 429 daily_quota_exceeded"),
          );
        }
        sent.push(to);
        return Promise.resolve();
      },
    };
    const { deps, lines } = harness({ sender });
    await expect(deliverEnquiryMails(FACTS, deps)).resolves.toEqual({ sent: ["sender"] });
    expect(sent).toEqual(["priya@example.test"]);
    const failure = lines.find((line) => line.includes("enquiry mail not sent")) ?? "";
    expect(failure).toContain('"mail":"poster"');
    expect(failure).toContain("daily_quota_exceeded");
  });

  it("resolves when the sender throws for every mail", async () => {
    const { deps, lines } = harness({
      sender: createFakeMailSender({ failWith: new Error("boom for owner@example.test") }),
    });
    await expect(deliverEnquiryMails(FACTS, deps)).resolves.toEqual({ sent: [] });
    expect(lines.filter((line) => line.includes("enquiry mail not sent"))).toHaveLength(2);
    // A plain error may carry anything, so only its code is kept.
    expect(lines.join("\n")).not.toContain("boom");
  });

  it("uses the wording in code when the saved wording cannot be read", async () => {
    const { deps, sender, lines } = harness({
      templates: () => Promise.reject(new Error("db down")),
    });
    expect(await deliverEnquiryMails(FACTS, deps)).toEqual({ sent: ["poster", "sender"] });
    expect(sentOf(sender)[0]?.subject).toBe("You got an enquiry from Priya Raman");
    expect(lines.join("\n")).toContain("using the wording in code");
  });

  it("sends the wording in code when a saved template breaks a rule, and logs that without the text", async () => {
    const { deps, sender, lines } = harness({
      templates: () =>
        Promise.resolve({
          enquiry_poster: { subject: "Hi {phone}", body: "{enquirerName} {secret}" },
          enquiry_sender: DEFAULT_MAIL_TEMPLATES.enquiry_sender,
        }),
    });
    await deliverEnquiryMails(FACTS, deps);
    expect(sentOf(sender)[0]?.subject).toBe("You got an enquiry from Priya Raman");
    const warning = lines.find((line) => line.includes("saved wording could not be used")) ?? "";
    expect(warning).toContain('"mail":"poster"');
    expect(warning).not.toContain("{secret}");
  });
});

describe("UT-enquiry-mail: no personal data in the logs (R-BE-10)", () => {
  it("writes no address, name, title or link in any line, whether the mails go out or fail", async () => {
    const happy = harness();
    await deliverEnquiryMails(FACTS, happy.deps);
    const failing = harness({ sender: createFakeMailSender({ failWith: new Error("x") }) });
    await deliverEnquiryMails(FACTS, failing.deps);
    const capped = harness({ withinCap: () => Promise.resolve(false) });
    await deliverEnquiryMails(FACTS, capped.deps);
    const everything = [...happy.lines, ...failing.lines, ...capped.lines].join("\n");
    expect(everything).not.toBe("");
    for (const secret of [
      "owner@example.test",
      "priya@example.test",
      "example.test",
      "Priya",
      "Raman",
      "Adyar",
      "k3x9a2bd",
      "dashboard",
    ]) {
      expect(everything).not.toContain(secret);
    }
  });
});
