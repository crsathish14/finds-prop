// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { CrmIntegrationView } from "../view";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { CrmEditor } = await import("../crm-editor.client");

const words = en.admin.crm.editor;

const ID = "00000000-0000-4000-a000-000000000001";
const PROJECT_A = "00000000-0000-4000-a000-0000000000a1";
const PROJECT_B = "00000000-0000-4000-a000-0000000000b2";
const PROJECTS = [
  { id: PROJECT_A, name: "Kadal Vista" },
  { id: PROJECT_B, name: "Marina Court" },
];

const SAVED_KEY = "fake-key-for-tests-saved";

const connection = (extra: Partial<CrmIntegrationView> = {}): CrmIntegrationView => ({
  id: ID,
  name: "Sample CRM",
  leadSource: "Find Prop website",
  baseUrl: "https://api.crm.example",
  endpoint: "/v2/leads",
  method: "POST",
  leadIdPath: "data.lead.id",
  active: true,
  headers: [{ name: "X-Source", value: "findprop" }],
  bodyMapping: [{ field: "full_name", value: "{{name}}" }],
  projectCodes: [{ projectId: PROJECT_A, code: "KV-01" }],
  hasApiKey: true,
  hasApiSecret: false,
  hasAccessToken: true,
  forms: 2,
  ...extra,
});

type Props = Parameters<typeof CrmEditor>[0];
type Save = Props["save"];

function open(integration: CrmIntegrationView | null, save?: Save) {
  const given: Save =
    save ?? vi.fn(async () => ({ ok: true as const, data: { integrationId: ID } }));
  const view = renderWithMessages(
    <CrmEditor integration={integration} projects={PROJECTS} save={given} />,
  );
  return { save: given as Mock, ...view };
}

const box = (text: string) => new RegExp(`^${text}`);
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const type = (label: string | RegExp, value: string, index = 0) =>
  fireEvent.change(screen.getAllByLabelText(label)[index] as HTMLElement, { target: { value } });
const saveIt = () => press(words.save.save);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the CRM editor: a new connection (S7-T09 D2)", () => {
  it("has the page frame, the three boxes and the save bar", () => {
    open(null);
    expect(screen.getByRole("heading", { level: 1, name: words.newTitle })).toBeVisible();
    expect(screen.getByRole("link", { name: words.crumb.crm })).toHaveAttribute(
      "href",
      "/admin/crm",
    );
    expect(screen.getByRole("heading", { name: words.connection.title })).toBeVisible();
    expect(screen.getByRole("heading", { name: words.credentials.title })).toBeVisible();
    expect(screen.getByText(words.credentials.description)).toBeVisible();
    expect(screen.getByRole("heading", { name: words.headersBody.title })).toBeVisible();
    expect(screen.getByText(words.save.note)).toBeVisible();
    expect(screen.getByRole("button", { name: words.save.save })).toBeVisible();
    expect(screen.getByText(words.headersBody.headers.empty)).toBeVisible();
    expect(screen.getByText(words.headersBody.mapping.empty)).toBeVisible();
    expect(screen.getByText(words.headersBody.codes.empty)).toBeVisible();
    expect(screen.getByText("(use {{field_key}} from the form)")).toBeVisible();
  });

  it("has nothing saved for any secret: three empty boxes that say Not set", () => {
    open(null);
    expect(screen.getAllByPlaceholderText(words.credentials.notSet)).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /Replace/ })).toBeNull();
  });

  it("sends what is typed, makes the connection and opens it on its own page", async () => {
    const { save } = open(null);
    type(box(words.connection.name), "Sample CRM");
    type(box(words.connection.baseUrl), "https://api.crm.example");
    type(box(words.connection.endpoint), "/v2/leads");
    fireEvent.change(screen.getByLabelText(box(words.connection.method)), {
      target: { value: "PUT" },
    });
    fireEvent.change(screen.getByLabelText(words.credentials.apiKey), {
      target: { value: "fake-key-for-tests" },
    });
    saveIt();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith({
      name: "Sample CRM",
      leadSource: "",
      baseUrl: "https://api.crm.example",
      endpoint: "/v2/leads",
      method: "PUT",
      leadIdPath: "",
      active: true,
      headers: [],
      bodyMapping: [],
      projectCodes: [],
      secrets: { apiKey: "fake-key-for-tests" },
    });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/admin/crm/${ID}`));
    expect(toast.success).toHaveBeenCalledWith(words.saved);
  });

  it("goes back to the list on Cancel", () => {
    open(null);
    press(words.save.cancel);
    expect(router.push).toHaveBeenCalledWith("/admin/crm");
  });
});

describe("the CRM editor: a connection that exists (S7-T09 D2)", () => {
  it("opens with the saved boxes and the connection's name as its heading", () => {
    open(connection());
    expect(screen.getByRole("heading", { level: 1, name: "Sample CRM" })).toBeVisible();
    expect(screen.getByLabelText(box(words.connection.name))).toHaveValue("Sample CRM");
    expect(screen.getByLabelText(box(words.connection.leadSource))).toHaveValue(
      "Find Prop website",
    );
    expect(screen.getByLabelText(box(words.connection.endpoint))).toHaveValue("/v2/leads");
    expect(screen.getByLabelText(box(words.connection.leadIdPath))).toHaveValue("data.lead.id");
    expect(screen.getByLabelText(words.headersBody.headers.name)).toHaveValue("X-Source");
    expect(screen.getByLabelText(words.headersBody.headers.value)).toHaveValue("findprop");
    expect(screen.getByLabelText(words.headersBody.mapping.name)).toHaveValue("full_name");
    expect(screen.getByLabelText(words.headersBody.mapping.value)).toHaveValue("{{name}}");
    expect(screen.getByLabelText(words.headersBody.codes.name)).toHaveValue(PROJECT_A);
    expect(screen.getByLabelText(words.headersBody.codes.value)).toHaveValue("KV-01");
  });

  it("shows a saved secret as dots only, never as a value, and a secret not saved as empty", () => {
    const { container } = open(connection());
    const key = screen.getByLabelText(words.credentials.apiKey);
    expect(key).toHaveValue("••••••••••••••••");
    expect(key).toHaveAttribute("readonly");
    expect(screen.getByLabelText(words.credentials.accessToken)).toHaveValue("••••••••••••••••");
    expect(screen.getByLabelText(words.credentials.apiSecret)).toHaveAttribute(
      "placeholder",
      words.credentials.notSet,
    );
    expect(container.innerHTML).not.toContain(SAVED_KEY);
  });

  it("saves the changes with the connection's id and leaves every secret out", async () => {
    const { save } = open(connection());
    type(box(words.connection.name), "Sample CRM (live)");
    saveIt();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const sent = save.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sent).toMatchObject({ integrationId: ID, name: "Sample CRM (live)" });
    expect(sent).not.toHaveProperty("secrets");
    expect(sent["headers"]).toEqual([{ name: "X-Source", value: "findprop" }]);
    expect(sent["projectCodes"]).toEqual([{ projectId: PROJECT_A, code: "KV-01" }]);
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(router.push).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(words.saved);
  });

  it("replaces a secret: Replace gives a password box that does not autofill, and the text is sent once", async () => {
    const { save } = open(connection());
    press(`${words.credentials.replace} ${words.credentials.apiKey}`);
    const box = screen.getByLabelText(words.credentials.apiKey);
    expect(box).toHaveAttribute("type", "password");
    expect(box).toHaveAttribute("autocomplete", "new-password");
    expect(box).toHaveValue("");
    fireEvent.change(box, { target: { value: "fake-key-for-tests" } });
    saveIt();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0]).toMatchObject({ secrets: { apiKey: "fake-key-for-tests" } });
    // Saved: the page is read again and the secret is back to its dots, with the typed text gone.
    await waitFor(() =>
      expect(screen.getByLabelText(words.credentials.apiKey)).toHaveValue("••••••••••••••••"),
    );
    expect(screen.queryByDisplayValue("fake-key-for-tests")).toBeNull();
  });

  it("drops what was typed when Cancel is pressed, and sends no secret", async () => {
    const { save } = open(connection());
    press(`${words.credentials.replace} ${words.credentials.apiKey}`);
    fireEvent.change(screen.getByLabelText(words.credentials.apiKey), {
      target: { value: "fake-key-for-tests" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: words.credentials.cancel })[0] as HTMLElement,
    );
    expect(screen.getByLabelText(words.credentials.apiKey)).toHaveValue("••••••••••••••••");
    saveIt();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0]).not.toHaveProperty("secrets");
  });

  it("clears a secret: says what saving will do, sends null, and Undo takes it back", async () => {
    const { save } = open(connection());
    press(`${words.credentials.clear} ${words.credentials.accessToken}`);
    expect(screen.getByDisplayValue(words.credentials.willClear)).toBeVisible();
    saveIt();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0]).toMatchObject({ secrets: { accessToken: null } });

    save.mockClear();
    press(`${words.credentials.clear} ${words.credentials.apiKey}`);
    press(words.credentials.undo);
    expect(screen.getByLabelText(words.credentials.apiKey)).toHaveValue("••••••••••••••••");
    saveIt();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0]).not.toHaveProperty("secrets");
  });
});

describe("the CRM editor: the Headers and body lists (S7-T09 D2)", () => {
  it("adds a header, a mapping and a code, and sends them", async () => {
    const { save } = open(null);
    press(words.headersBody.headers.add);
    type(words.headersBody.headers.name, "X-Source");
    type(words.headersBody.headers.value, "findprop");
    press(words.headersBody.mapping.add);
    type(words.headersBody.mapping.name, "full_name");
    type(words.headersBody.mapping.value, "{{name}}");
    press(words.headersBody.codes.add);
    fireEvent.change(screen.getByLabelText(words.headersBody.codes.name), {
      target: { value: PROJECT_B },
    });
    type(words.headersBody.codes.value, "MC-7");
    type(box(words.connection.name), "Sample CRM");
    type(box(words.connection.baseUrl), "https://api.crm.example");
    saveIt();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      headers: [{ name: "X-Source", value: "findprop" }],
      bodyMapping: [{ field: "full_name", value: "{{name}}" }],
      projectCodes: [{ projectId: PROJECT_B, code: "MC-7" }],
    });
  });

  it("offers every project for a code, by name", () => {
    open(connection());
    const choice = screen.getByLabelText(words.headersBody.codes.name);
    expect(within(choice).getByRole("option", { name: "Kadal Vista" })).toBeVisible();
    expect(within(choice).getByRole("option", { name: "Marina Court" })).toBeVisible();
    expect(
      within(choice).getByRole("option", { name: words.headersBody.codes.choose }),
    ).toBeVisible();
  });

  it("removes a row, and names the row on its button", () => {
    open(connection());
    expect(screen.getByRole("button", { name: "Remove header X-Source" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove mapping full_name" })).toBeVisible();
    press("Remove code for Kadal Vista");
    expect(screen.getByText(words.headersBody.codes.empty)).toBeVisible();
  });

  it("leaves out a row that was added and left empty", async () => {
    const { save } = open(connection());
    press(words.headersBody.headers.add);
    saveIt();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      headers: [{ name: "X-Source", value: "findprop" }],
    });
  });

  it("flags a name used twice before sending, on the later row, and clears it when the name is changed", async () => {
    const { save } = open(connection());
    press(words.headersBody.headers.add);
    type(words.headersBody.headers.name, "x-source", 1);
    type(words.headersBody.headers.value, "again", 1);
    saveIt();
    expect(await screen.findByText(en.validation.localityLabelTaken)).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("1 thing needs attention");
    expect(save).not.toHaveBeenCalled();
    type(words.headersBody.headers.name, "X-Other", 1);
    await waitFor(() => expect(screen.queryByText(en.validation.localityLabelTaken)).toBeNull());
  });
});

describe("the CRM editor: what the server says is wrong (S7-T09 D2)", () => {
  const failing = (fieldErrors: Record<string, { key: string }[]>) =>
    vi.fn(async () => ({ ok: false as const, code: "VALIDATION" as const, fieldErrors }));

  it("puts an address that is not allowed under Base URL, and in the summary", async () => {
    const { save } = open(
      connection(),
      failing({ baseUrl: [{ key: "validation.crmUrlNotAllowed" }] }),
    );
    saveIt();
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(await screen.findByText(en.validation.crmUrlNotAllowed)).toBeVisible();
    expect(screen.getByLabelText(box(words.connection.baseUrl))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(words.problems.text);
    expect(toast.success).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("puts a row's problem on that row's box, even when an empty row before it was left out", async () => {
    const { save } = open(
      connection({ headers: [] }),
      failing({ "headers.0.value": [{ key: "validation.invalid" }] }),
    );
    press(words.headersBody.headers.add);
    press(words.headersBody.headers.add);
    type(words.headersBody.headers.name, "X-A", 1);
    saveIt();
    await waitFor(() => expect(save).toHaveBeenCalled());
    const [first, second] = screen.getAllByLabelText(words.headersBody.headers.value);
    expect(await screen.findByText(en.validation.invalid)).toBeVisible();
    expect(first).not.toHaveAttribute("aria-invalid", "true");
    expect(second).toHaveAttribute("aria-invalid", "true");
  });

  it("puts a secret's problem under that secret", async () => {
    const { save } = open(
      connection(),
      failing({ "secrets.apiSecret": [{ key: "validation.invalid" }] }),
    );
    fireEvent.change(screen.getByLabelText(words.credentials.apiSecret), {
      target: { value: "fake-secret-for-tests" },
    });
    saveIt();
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(await screen.findByText(en.validation.invalid)).toBeVisible();
  });

  it("keeps what was typed when the save fails", async () => {
    const { save } = open(
      connection(),
      failing({ baseUrl: [{ key: "validation.crmUrlNotAllowed" }] }),
    );
    press(`${words.credentials.replace} ${words.credentials.apiKey}`);
    fireEvent.change(screen.getByLabelText(words.credentials.apiKey), {
      target: { value: "fake-key-for-tests" },
    });
    type(box(words.connection.name), "Renamed CRM");
    saveIt();
    await waitFor(() => expect(save).toHaveBeenCalled());
    await screen.findByText(en.validation.crmUrlNotAllowed);
    expect(screen.getByLabelText(box(words.connection.name))).toHaveValue("Renamed CRM");
    expect(screen.getByLabelText(words.credentials.apiKey)).toHaveValue("fake-key-for-tests");
  });

  it("says a failure with no box to blame in words, and reads the page again", async () => {
    const limited = vi.fn(async () => ({
      ok: false as const,
      code: "RATE_LIMITED" as const,
      retryAfter: 120,
    }));
    open(connection(), limited);
    saveIt();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Too many attempts. Please try again in 2 minutes."),
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it("turns everything off and says Saving while it saves", async () => {
    let finish: (value: { ok: true; data: { integrationId: string } }) => void = () => undefined;
    const slow = vi.fn(
      () =>
        new Promise<{ ok: true; data: { integrationId: string } }>((resolve) => {
          finish = resolve;
        }),
    );
    open(connection(), slow);
    saveIt();
    expect(await screen.findByRole("button", { name: words.save.saving })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByLabelText(box(words.connection.name))).toBeDisabled();
    finish({ ok: true, data: { integrationId: ID } });
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });
});
