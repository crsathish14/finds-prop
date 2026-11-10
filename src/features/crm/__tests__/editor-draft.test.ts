import { describe, expect, it } from "vitest";
import {
  blankDraft,
  countProblems,
  draftOf,
  duplicateRowProblems,
  nextRowId,
  noProblems,
  payloadOf,
  problemsOf,
  without,
  type CrmDraft,
} from "../editor-draft";
import type { CrmIntegrationView } from "../view";

const NONE = { apiKey: false, apiSecret: false, accessToken: false };
const SAVED = { apiKey: true, apiSecret: true, accessToken: true };

const PROJECT_A = "00000000-0000-4000-a000-0000000000a1";
const PROJECT_B = "00000000-0000-4000-a000-0000000000b2";

const view = (extra: Partial<CrmIntegrationView> = {}): CrmIntegrationView => ({
  id: "00000000-0000-4000-a000-000000000001",
  name: "Sample CRM",
  leadSource: "Find Prop website",
  baseUrl: "https://api.crm.example",
  endpoint: "/v2/leads",
  method: "PUT",
  leadIdPath: "data.lead.id",
  active: false,
  headers: [{ name: "X-Source", value: "findprop" }],
  bodyMapping: [{ field: "full_name", value: "{{name}}" }],
  projectCodes: [{ projectId: PROJECT_A, code: "KV-01" }],
  hasApiKey: true,
  hasApiSecret: false,
  hasAccessToken: true,
  forms: 1,
  ...extra,
});

const draftWith = (change: (draft: CrmDraft) => void): CrmDraft => {
  const draft = blankDraft();
  change(draft);
  return draft;
};

describe("UT-crm-editor-draft: what the CRM editor keeps and sends (S7-T09 D2)", () => {
  describe("the draft", () => {
    it("starts a new connection empty, on, POST, with every secret kept", () => {
      expect(blankDraft()).toEqual({
        connection: {
          name: "",
          leadSource: "",
          baseUrl: "",
          endpoint: "",
          method: "POST",
          leadIdPath: "",
          active: true,
        },
        secrets: {
          apiKey: { mode: "keep", value: "" },
          apiSecret: { mode: "keep", value: "" },
          accessToken: { mode: "keep", value: "" },
        },
        headers: [],
        mapping: [],
        codes: [],
      });
    });

    it("fills the draft from a connection that exists, with nothing typed for any secret", () => {
      const draft = draftOf(view());
      expect(draft.connection).toEqual({
        name: "Sample CRM",
        leadSource: "Find Prop website",
        baseUrl: "https://api.crm.example",
        endpoint: "/v2/leads",
        method: "PUT",
        leadIdPath: "data.lead.id",
        active: false,
      });
      expect(draft.headers).toEqual([{ id: "h0", first: "X-Source", second: "findprop" }]);
      expect(draft.mapping).toEqual([{ id: "m0", first: "full_name", second: "{{name}}" }]);
      expect(draft.codes).toEqual([{ id: "c0", first: PROJECT_A, second: "KV-01" }]);
      expect(Object.values(draft.secrets)).toEqual([
        { mode: "keep", value: "" },
        { mode: "keep", value: "" },
        { mode: "keep", value: "" },
      ]);
    });

    it("shows a missing lead source, endpoint and lead id path as empty boxes", () => {
      const draft = draftOf(view({ leadSource: null, endpoint: null, leadIdPath: null }));
      expect(draft.connection).toMatchObject({ leadSource: "", endpoint: "", leadIdPath: "" });
    });

    it("gives a new row an id its list does not have", () => {
      expect(nextRowId("headers", [])).toBe("h0");
      expect(
        nextRowId("mapping", [
          { id: "m0", first: "", second: "" },
          { id: "m4", first: "", second: "" },
        ]),
      ).toBe("m5");
      expect(nextRowId("codes", [{ id: "c1", first: "", second: "" }])).toBe("c2");
    });
  });

  describe("the save request", () => {
    it("sends the boxes as they are typed, with the rows as the server wants them", () => {
      const { payload } = payloadOf(draftOf(view()), SAVED);
      expect(payload).toEqual({
        name: "Sample CRM",
        leadSource: "Find Prop website",
        baseUrl: "https://api.crm.example",
        endpoint: "/v2/leads",
        method: "PUT",
        leadIdPath: "data.lead.id",
        active: false,
        headers: [{ name: "X-Source", value: "findprop" }],
        bodyMapping: [{ field: "full_name", value: "{{name}}" }],
        projectCodes: [{ projectId: PROJECT_A, code: "KV-01" }],
      });
    });

    it("leaves a kept secret out, so the server keeps what it holds", () => {
      const { payload } = payloadOf(draftOf(view()), SAVED);
      expect(payload).not.toHaveProperty("secrets");
    });

    it("sends the text typed for a replaced secret", () => {
      const draft = draftWith((made) => {
        made.secrets.apiKey = { mode: "replace", value: "fake-key-for-tests" };
      });
      expect(payloadOf(draft, SAVED).payload["secrets"]).toEqual({ apiKey: "fake-key-for-tests" });
    });

    it("leaves a replaced secret out when nothing was typed, which keeps what is saved", () => {
      const draft = draftWith((made) => {
        made.secrets.apiKey = { mode: "replace", value: "   " };
      });
      expect(payloadOf(draft, SAVED).payload).not.toHaveProperty("secrets");
    });

    it("sends null for a secret to be cleared, and only when one is saved", () => {
      const draft = draftWith((made) => {
        made.secrets.apiKey = { mode: "clear", value: "" };
        made.secrets.apiSecret = { mode: "clear", value: "" };
      });
      expect(payloadOf(draft, { ...NONE, apiKey: true }).payload["secrets"]).toEqual({
        apiKey: null,
      });
    });

    it("sends the text typed for a secret that had nothing saved, and nothing when the box is empty", () => {
      const draft = draftWith((made) => {
        made.secrets.accessToken = { mode: "keep", value: "fake-token-for-tests" };
      });
      expect(payloadOf(draft, NONE).payload["secrets"]).toEqual({
        accessToken: "fake-token-for-tests",
      });
      expect(payloadOf(blankDraft(), NONE).payload).not.toHaveProperty("secrets");
    });

    it("leaves out a row with both boxes empty and keeps one with a single box empty", () => {
      const draft = draftWith((made) => {
        made.headers = [
          { id: "h0", first: "X-A", second: "1" },
          { id: "h1", first: "", second: "" },
          { id: "h2", first: "X-B", second: "" },
        ];
      });
      const { payload, sent } = payloadOf(draft, NONE);
      expect(payload["headers"]).toEqual([
        { name: "X-A", value: "1" },
        { name: "X-B", value: "" },
      ]);
      expect(sent.headers).toEqual(["h0", "h2"]);
    });
  });

  describe("a name used twice", () => {
    it("is flagged on the later row, ignoring case and spaces at the ends", () => {
      const draft = draftWith((made) => {
        made.headers = [
          { id: "h0", first: "X-Source", second: "a" },
          { id: "h1", first: "x-source ", second: "b" },
        ];
        made.mapping = [
          { id: "m0", first: "phone", second: "{{mobile}}" },
          { id: "m1", first: "phone", second: "{{alt}}" },
        ];
        made.codes = [
          { id: "c0", first: PROJECT_A, second: "1" },
          { id: "c1", first: PROJECT_B, second: "2" },
          { id: "c2", first: PROJECT_A, second: "3" },
        ];
      });
      const found = duplicateRowProblems(draft, "Another row already uses this name.");
      expect(found.headers).toEqual({ h1: { first: "Another row already uses this name." } });
      expect(found.mapping).toEqual({ m1: { first: "Another row already uses this name." } });
      expect(found.codes).toEqual({ c2: { first: "Another row already uses this name." } });
      expect(countProblems(found)).toBe(3);
    });

    it("ignores empty rows, and finds nothing when every name is its own", () => {
      const draft = draftWith((made) => {
        made.headers = [
          { id: "h0", first: "", second: "" },
          { id: "h1", first: "", second: "" },
          { id: "h2", first: "X-A", second: "" },
        ];
      });
      expect(countProblems(duplicateRowProblems(draft, "x"))).toBe(0);
    });
  });

  describe("what the server says is wrong", () => {
    const sent = { headers: ["h0", "h2"], mapping: ["m0"], codes: ["c3"] };

    it("goes on the box it names", () => {
      const found = problemsOf(
        {
          baseUrl: "Must be https and a public address.",
          name: "This field is required.",
          "secrets.apiKey": "This value is not valid.",
        },
        sent,
      );
      expect(found.connection).toEqual({
        baseUrl: "Must be https and a public address.",
        name: "This field is required.",
      });
      expect(found.secrets).toEqual({ apiKey: "This value is not valid." });
    });

    it("finds the draft row from the row's place in the request", () => {
      const found = problemsOf(
        {
          "headers.1.value": "This value is not valid.",
          "bodyMapping.0.field": "This field is required.",
          "projectCodes.0.projectId": "This value is not valid.",
          "projectCodes.0.code": "This field is required.",
        },
        sent,
      );
      expect(found.headers).toEqual({ h2: { second: "This value is not valid." } });
      expect(found.mapping).toEqual({ m0: { first: "This field is required." } });
      expect(found.codes).toEqual({
        c3: { first: "This value is not valid.", second: "This field is required." },
      });
    });

    it("becomes a note for the whole form when no box is named, or the row is unknown", () => {
      const found = problemsOf(
        { _form: "Something is wrong.", "headers.9.name": "Gone.", "secrets.other": "Odd." },
        sent,
      );
      expect(found.form).toEqual(["Something is wrong.", "Gone.", "Odd."]);
      expect(countProblems(found)).toBe(3);
    });

    it("starts with nothing wrong, and each use gets its own record", () => {
      const first = noProblems();
      first.connection.name = "x";
      expect(noProblems().connection).toEqual({});
      expect(countProblems(noProblems())).toBe(0);
    });
  });

  it("copies a record without one key", () => {
    expect(without({ alpha: "1", beta: "2" }, "alpha")).toEqual({ beta: "2" });
    expect(without({ alpha: "1" }, "zeta")).toEqual({ alpha: "1" });
  });
});
