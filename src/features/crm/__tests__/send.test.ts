import { describe, expect, it, vi } from "vitest";
import { RESPONSE_BYTES_MAX, SNIPPET_MAX } from "../constants";
import {
  fillTemplate,
  joinUrl,
  pickPath,
  redact,
  sendToCrm,
  type CrmConnection,
  type CrmSecrets,
} from "../send";

const CONNECTION: CrmConnection = {
  baseUrl: "https://api.crm-vendor.com/",
  endpoint: "/v2/leads",
  method: "POST",
  leadSource: "Find Prop",
  leadIdPath: "data.lead.id",
  headers: { Authorization: "Bearer {{access_token}}", "X-Api-Key": "{{api_key}}" },
  bodyMapping: {
    fullName: "{{name}}",
    phone: "{{mobile}}",
    source: "{{lead_source}}",
    project: "{{project_code}}",
  },
};
const SECRETS: CrmSecrets = {
  apiKey: "fake-key-for-tests",
  apiSecret: "fake-secret-for-tests",
  accessToken: "fake-token-for-tests",
};
const VALUES = { name: "Priya", mobile: "9840012345", project_code: "KV-01" };
const lookup = async () => ["93.184.216.34"];

type Captured = { url: string; init: RequestInit };
function fetchAnswering(answer: Response | Error, captured: Captured[] = []): typeof fetch {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    captured.push({ url: String(url), init: init ?? {} });
    if (answer instanceof Error) throw answer;
    return answer;
  }) as unknown as typeof fetch;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("UT-crm-send: the pieces of a CRM call (S7-T09)", () => {
  it("fills {{names}} with the values, and nothing for a name it does not know", () => {
    expect(fillTemplate("Hi {{ name }}, {{missing}}!", { name: "Priya" })).toBe("Hi Priya, !");
    expect(fillTemplate("no names", {})).toBe("no names");
  });

  it("joins the base and the endpoint with one slash", () => {
    expect(joinUrl("https://a.com/", "/v2/leads")).toBe("https://a.com/v2/leads");
    expect(joinUrl("https://a.com", "v2")).toBe("https://a.com/v2");
    expect(joinUrl("https://a.com/base//", "//x")).toBe("https://a.com/base/x");
    expect(joinUrl("https://a.com/base", null)).toBe("https://a.com/base");
  });

  it("picks a text or number by its dotted path, and nothing else", () => {
    const answer = { data: { lead: { id: "CRM-4821", count: 7, deep: { inner: 1 }, flag: true } } };
    expect(pickPath(answer, "data.lead.id")).toBe("CRM-4821");
    expect(pickPath(answer, "data.lead.count")).toBe("7");
    expect(pickPath(answer, "data.lead.deep")).toBeNull();
    expect(pickPath(answer, "data.lead.flag")).toBeNull();
    expect(pickPath(answer, "data.nope.id")).toBeNull();
    expect(pickPath(answer, null)).toBeNull();
    expect(pickPath("text", "a")).toBeNull();
  });

  it("blanks out every secret value in a text, and ignores very short ones", () => {
    expect(
      redact("echo fake-key-for-tests and fake-token-for-tests and fake-key-for-tests", SECRETS),
    ).toBe("echo *** and *** and ***");
    expect(redact("ab ab", { apiKey: "ab", apiSecret: null, accessToken: "" })).toBe("ab ab");
  });
});

describe("UT-crm-send: one call to a CRM (S7-T09, BR-64, BR-65)", () => {
  it("sends the filled headers and body to the joined address, with redirects off, and reads the lead id", async () => {
    const captured: Captured[] = [];
    const result = await sendToCrm(CONNECTION, SECRETS, VALUES, {
      fetch: fetchAnswering(json({ data: { lead: { id: "CRM-4821" } } }), captured),
      lookup,
    });
    expect(result).toMatchObject({ ok: true, status: 200, leadId: "CRM-4821" });
    expect(captured).toHaveLength(1);
    const { url, init } = captured[0] as Captured;
    expect(url).toBe("https://api.crm-vendor.com/v2/leads");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer fake-token-for-tests");
    expect(headers.get("x-api-key")).toBe("fake-key-for-tests");
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init.body))).toEqual({
      fullName: "Priya",
      phone: "9840012345",
      source: "Find Prop",
      project: "KV-01",
    });
  });

  it("keeps a content type the connection sets, and uses PUT when asked", async () => {
    const captured: Captured[] = [];
    await sendToCrm(
      { ...CONNECTION, method: "PUT", headers: { "Content-Type": "application/vnd.crm+json" } },
      SECRETS,
      VALUES,
      { fetch: fetchAnswering(json({}), captured), lookup },
    );
    expect(captured[0]?.init.method).toBe("PUT");
    expect((captured[0]?.init.headers as Headers).get("content-type")).toBe(
      "application/vnd.crm+json",
    );
  });

  it("calls a failure any answer that is not 2xx, and keeps the start of the answer", async () => {
    const result = await sendToCrm(CONNECTION, SECRETS, VALUES, {
      fetch: fetchAnswering(new Response("Bad gateway: upstream timed out", { status: 502 })),
      lookup,
    });
    expect(result).toEqual({
      ok: false,
      status: 502,
      snippet: "Bad gateway: upstream timed out",
      leadId: null,
      durationMs: expect.any(Number),
    });
  });

  it("never lets an answer that echoes a secret reach the log (BR-64)", async () => {
    const result = await sendToCrm(CONNECTION, SECRETS, VALUES, {
      fetch: fetchAnswering(
        new Response(
          `bad key fake-key-for-tests, bad token fake-token-for-tests, secret fake-secret-for-tests`,
          {
            status: 401,
          },
        ),
      ),
      lookup,
    });
    expect(result.snippet).toBe("bad key ***, bad token ***, secret ***");
    expect(result.snippet).not.toMatch(/fake-(key|secret|token)-for-tests/);
  });

  it("cuts a long answer at the log's limit, and reads no more than the byte limit", async () => {
    const result = await sendToCrm(CONNECTION, SECRETS, VALUES, {
      fetch: fetchAnswering(new Response("x".repeat(RESPONSE_BYTES_MAX * 3), { status: 500 })),
      lookup,
    });
    expect(result.snippet).toHaveLength(SNIPPET_MAX);
  });

  it("does not follow a redirect: it is a failure with a plain sentence", async () => {
    const captured: Captured[] = [];
    const result = await sendToCrm(CONNECTION, SECRETS, VALUES, {
      fetch: fetchAnswering(
        new Response("", { status: 302, headers: { location: "https://169.254.169.254/" } }),
        captured,
      ),
      lookup,
    });
    expect(result).toMatchObject({ ok: false, status: 302, leadId: null });
    expect(result.snippet).toBe(
      "The CRM tried to send the call to another address, which is not followed.",
    );
    expect(captured).toHaveLength(1);
  });

  it("does not send at all to an address that is not public https, and says so without the address", async () => {
    const fetcher = fetchAnswering(json({}));
    for (const baseUrl of ["http://api.crm-vendor.com", "https://10.0.0.5", "https://localhost"]) {
      const result = await sendToCrm({ ...CONNECTION, baseUrl }, SECRETS, VALUES, {
        fetch: fetcher,
        lookup,
      });
      expect(result).toMatchObject({ ok: false, status: null, leadId: null });
      expect(result.snippet).toBe("This address is not allowed: it must be https and public.");
    }
    const inside = await sendToCrm(CONNECTION, SECRETS, VALUES, {
      fetch: fetcher,
      lookup: async () => ["10.0.0.5"],
    });
    expect(inside.status).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("answers plainly when the CRM cannot be reached or is too slow, without the network's own text", async () => {
    const unreachable = await sendToCrm(CONNECTION, SECRETS, VALUES, {
      fetch: fetchAnswering(new TypeError("fetch failed: connect ECONNREFUSED 93.184.216.34:443")),
      lookup,
    });
    expect(unreachable).toMatchObject({
      ok: false,
      status: null,
      snippet: "The CRM could not be reached.",
    });
    const slow = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    const timedOut = await sendToCrm(CONNECTION, SECRETS, VALUES, {
      fetch: fetchAnswering(slow),
      lookup,
    });
    expect(timedOut).toMatchObject({
      ok: false,
      status: null,
      snippet: "The CRM did not answer in time.",
    });
  });

  it("fails, rather than throws, when a header value cannot be sent", async () => {
    const result = await sendToCrm(
      { ...CONNECTION, headers: { "X-Note": "{{note}}" } },
      SECRETS,
      { ...VALUES, note: "line one\nline two" },
      { fetch: fetchAnswering(json({})), lookup },
    );
    expect(result).toMatchObject({ ok: false, status: null });
  });

  it("is a success with no lead id when the answer is not JSON, or has no id at the path", async () => {
    const plain = await sendToCrm(CONNECTION, SECRETS, VALUES, {
      fetch: fetchAnswering(new Response("OK", { status: 200 })),
      lookup,
    });
    expect(plain).toMatchObject({ ok: true, status: 200, leadId: null, snippet: "OK" });
    const empty = await sendToCrm(CONNECTION, SECRETS, VALUES, {
      fetch: fetchAnswering(json({ ok: true })),
      lookup,
    });
    expect(empty).toMatchObject({ ok: true, leadId: null });
  });

  it("measures how long the call took with the clock it was given", async () => {
    const clock = [1_000, 1_412];
    const result = await sendToCrm(CONNECTION, SECRETS, VALUES, {
      fetch: fetchAnswering(json({})),
      lookup,
      now: () => clock.shift() ?? 1_412,
    });
    expect(result.durationMs).toBe(412);
  });
});
