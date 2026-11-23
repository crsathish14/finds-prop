import { describe, expect, it } from "vitest";
import { DEFAULT_MAIL_TEMPLATES } from "@/lib/mail-template";
import { ActionError } from "@/server/actions/normalise-error";
import { MAIL_TEMPLATE_SETTING_KEYS } from "../constants";
import type { MailTemplateInput } from "../schemas";
import {
  dayInIndia,
  mapMailTemplateError,
  rowOf,
  saveMailTemplate,
  sendingTemplate,
  type MailTemplateStore,
} from "../save-service";

function fakeStore(initial: Record<string, unknown> = {}) {
  const rows = new Map<string, unknown>(Object.entries(initial));
  const writes: { key: string; value: Record<string, unknown> }[] = [];
  const store: MailTemplateStore = {
    read: (key) => Promise.resolve(rows.get(key) ?? null),
    write: (key, value) => {
      rows.set(key, value);
      writes.push({ key, value });
      return Promise.resolve();
    },
  };
  return { store, writes, rows };
}

function input(overrides: Partial<MailTemplateInput> = {}): MailTemplateInput {
  return {
    kind: "enquiry_poster",
    subject: "From {enquirerName}",
    body: "Hello, {enquirerName} wrote.",
    publish: false,
    ...overrides,
  };
}

const noon = new Date("2026-11-24T06:30:00Z");
const live = {
  subject: "Live {enquirerName}",
  body: "Live body {enquirerName}",
  updated: "2026-11-20",
};

describe("UT-mail-template-save: saving a mail's wording (ADR-183)", () => {
  it("keeps a first save as a working copy: not live, no date", async () => {
    const { store, writes } = fakeStore();
    expect(await saveMailTemplate(store, input(), noon)).toEqual({
      kind: "enquiry_poster",
      published: false,
    });
    expect(writes).toEqual([
      {
        key: "mail_enquiry_poster",
        value: {
          working: {
            subject: "From {enquirerName}",
            body: "Hello, {enquirerName} wrote.",
            updated: null,
          },
        },
      },
    ]);
  });

  it("publishes with the day in India and keeps no working copy", async () => {
    const { store, writes } = fakeStore({
      mail_enquiry_poster: { published: live, working: { ...live, updated: null } },
    });
    expect(await saveMailTemplate(store, input({ publish: true }), noon)).toEqual({
      kind: "enquiry_poster",
      published: true,
    });
    expect(writes[0]?.value).toEqual({
      published: {
        subject: "From {enquirerName}",
        body: "Hello, {enquirerName} wrote.",
        updated: "2026-11-24",
      },
    });
    expect(writes[0]?.value).not.toHaveProperty("working");
  });

  it("saving a draft over live wording leaves the live wording as it was", async () => {
    const { store, writes } = fakeStore({ mail_enquiry_poster: { published: live } });
    await saveMailTemplate(store, input({ subject: "Draft {enquirerName}" }), noon);
    expect(writes[0]?.value).toEqual({
      published: live,
      working: {
        subject: "Draft {enquirerName}",
        body: "Hello, {enquirerName} wrote.",
        updated: null,
      },
    });
  });

  it("writes each mail to its own row and never touches the other", async () => {
    const { store, writes, rows } = fakeStore({ mail_enquiry_poster: { published: live } });
    await saveMailTemplate(
      store,
      input({ kind: "enquiry_sender", subject: "Sent", body: "We sent it." }),
      noon,
    );
    expect(writes.map((write) => write.key)).toEqual([MAIL_TEMPLATE_SETTING_KEYS.enquiry_sender]);
    expect(rows.get("mail_enquiry_poster")).toEqual({ published: live });
  });

  it("treats a row that is not in the shape as empty, so a bad row never blocks a save", async () => {
    const { store, writes } = fakeStore({ mail_enquiry_poster: { published: { subject: 5 } } });
    await saveMailTemplate(store, input(), noon);
    expect(Object.keys(writes[0]?.value ?? {})).toEqual(["working"]);
  });

  it("stores nothing but the wording and a day", async () => {
    const { store, writes } = fakeStore();
    await saveMailTemplate(store, input({ publish: true }), noon);
    const published = (writes[0]?.value as { published: Record<string, unknown> }).published;
    expect(Object.keys(published).sort()).toEqual(["body", "subject", "updated"]);
  });
});

describe("UT-mail-template-save: reading a row", () => {
  it("sends with the published wording, else the wording in code", () => {
    expect(sendingTemplate(rowOf("enquiry_poster", { published: live }), "enquiry_poster")).toEqual(
      {
        subject: live.subject,
        body: live.body,
      },
    );
    expect(
      sendingTemplate(
        rowOf("enquiry_poster", { working: { ...live, updated: null } }),
        "enquiry_poster",
      ),
    ).toEqual(DEFAULT_MAIL_TEMPLATES.enquiry_poster);
    expect(sendingTemplate(rowOf("enquiry_sender", null), "enquiry_sender")).toEqual(
      DEFAULT_MAIL_TEMPLATES.enquiry_sender,
    );
  });

  it("ignores a published version that the mail's rules refuse (an unknown placeholder)", () => {
    const row = { published: { ...live, body: "Call {phone} {enquirerName}" } };
    expect(rowOf("enquiry_poster", row)).toEqual({});
    expect(sendingTemplate(rowOf("enquiry_poster", row), "enquiry_poster")).toEqual(
      DEFAULT_MAIL_TEMPLATES.enquiry_poster,
    );
  });

  it("takes the day in India: late evening UTC is already the next day", () => {
    expect(dayInIndia(new Date("2026-11-24T20:00:00Z"))).toBe("2026-11-25");
    expect(dayInIndia(new Date("2026-11-24T02:00:00Z"))).toBe("2026-11-24");
  });
});

describe("UT-mail-template-save: database failures", () => {
  it("turns them into the closed set of errors without repeating the database's words", () => {
    expect(mapMailTemplateError({ code: "42501", message: "secret" })).toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mapMailTemplateError({ code: "23514" })).toMatchObject({ code: "VALIDATION" });
    const other = mapMailTemplateError({ code: "XX000", message: "relation secret" });
    expect(other).toBeInstanceOf(ActionError);
    expect(other).toMatchObject({ code: "INTERNAL" });
    expect(other.message).not.toContain("secret");
  });
});
