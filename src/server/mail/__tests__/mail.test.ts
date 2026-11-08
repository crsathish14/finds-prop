import { describe, expect, it } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import {
  chooseMailSender,
  createFakeMailSender,
  createNoopMailSender,
  MAIL_TIMEOUT_MS,
  NOTIFICATION_KINDS,
  silentNotifier,
  type NotificationEvent,
} from "../index";

const message = {
  to: "owner@example.test",
  subject: "Someone asked about your listing",
  text: "Open your dashboard to read it.",
};

describe("UT-mail: the mail adapter hook points (S6-T07, DEC-27, R-BE-09)", () => {
  it("has a fake that sends nothing and remembers what it was asked to send, in order", async () => {
    const fake = createFakeMailSender();
    await fake.send(message);
    await fake.send({ ...message, to: "second@example.test" });
    expect(fake.sent.map((sent) => sent.to)).toEqual(["owner@example.test", "second@example.test"]);
    expect(fake.sent[0]).toEqual(message);
  });

  it("copies the message, so a later change to it does not rewrite what was sent", async () => {
    const fake = createFakeMailSender();
    const changing = { ...message };
    await fake.send(changing);
    changing.subject = "changed afterwards";
    expect(fake.sent[0]?.subject).toBe(message.subject);
  });

  it("has a fake that fails the way a provider would, and sends nothing then", async () => {
    const failure = new ActionError("UPSTREAM_FAILED", "The mail provider did not answer in time");
    const fake = createFakeMailSender({ failWith: failure });
    await expect(fake.send(message)).rejects.toBe(failure);
    expect(fake.sent).toEqual([]);
  });

  it("has a sender that accepts and drops a message, and says nothing about it", async () => {
    await expect(createNoopMailSender().send(message)).resolves.toBeUndefined();
  });

  it("chooses the sender that drops the message in every environment, because no provider is chosen yet", async () => {
    const sender = chooseMailSender();
    await expect(sender.send(message)).resolves.toBeUndefined();
  });

  it("gives an implementation the same time budget as the SMS adapter", () => {
    expect(MAIL_TIMEOUT_MS).toBe(3000);
  });

  it("names the three events with ids only, and a silent notifier that accepts every one", async () => {
    expect([...NOTIFICATION_KINDS]).toEqual([
      "enquiry.received",
      "listing.approved",
      "listing.rejected",
    ]);
    const events: NotificationEvent[] = [
      { kind: "enquiry.received", enquiryId: "e1", listingId: "l1" },
      { kind: "listing.approved", listingId: "l1", shortId: "abcd2345" },
      { kind: "listing.rejected", listingId: "l1", shortId: "abcd2345" },
    ];
    for (const event of events) {
      expect(NOTIFICATION_KINDS).toContain(event.kind);
      await expect(silentNotifier.notify(event)).resolves.toBeUndefined();
    }
  });
});
