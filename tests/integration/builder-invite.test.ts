import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { loadSessionView } from "@/server/auth/get-session-view";
import { builderStore } from "@/features/builders/service";
import { saveMyProfile } from "@/features/builders/profile-service";
import {
  inviteBuilder,
  resendInvitation,
  setBuilderActive,
  updateBuilderDetails,
} from "@/features/builders/builder-service";
import { ActionError } from "@/server/actions/normalise-error";
import { adminClient, visitorClient, type TestClient } from "./support/clients";

// IT-builder-invite (S7-T05, ADR-010): inviting a builder or an agent against a real database and the real auth
// service. Builders sign in with Google only, which cannot be reached locally, so a one-time link made by the
// service role stands in for it: it signs in the account the invitation made, and the session read shows what
// that person would be.

const RUN = randomUUID().slice(0, 8);
const admin = adminClient();
const store = builderStore(admin);
const madeBuilders: string[] = [];
const madeEmails: string[] = [];

const emailFor = (label: string) => {
  const address = `it-invite-${label}-${RUN}@example.test`;
  madeEmails.push(address);
  return address;
};

const details = (email: string, extra: Partial<Parameters<typeof inviteBuilder>[1]> = {}) => ({
  name: `Kadal Homes ${RUN}`,
  email,
  kind: "builder" as const,
  ...extra,
});

async function failureOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

async function signInAs(email: string): Promise<TestClient> {
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link.data.properties?.hashed_token;
  if (link.error || !tokenHash) throw new Error("Could not make a sign-in link");
  const client = visitorClient();
  const verified = await client.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (verified.error || !verified.data.user) throw new Error("Could not sign in");
  return client;
}

async function accountOf(email: string) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error("Could not list users");
  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

afterAll(async () => {
  if (madeBuilders.length > 0) await admin.from("builders").delete().in("id", madeBuilders);
  for (const address of madeEmails) {
    const account = await accountOf(address);
    if (account) await admin.auth.admin.deleteUser(account.id);
  }
});

describe("IT-builder-invite: inviting a builder against a real database (S7-T05)", () => {
  it("makes the account with a confirmed email, the builder role and the record, tied together", async () => {
    const email = emailFor("one");
    const { builderId } = await inviteBuilder(
      store,
      details(email, { contactPerson: "Meena Raj", website: "https://kadalhomes.example" }),
    );
    madeBuilders.push(builderId);
    const account = await accountOf(email);
    expect(account?.email_confirmed_at).toBeTruthy();
    const record = await admin.from("builders").select("*").eq("id", builderId).single();
    expect(record.data).toMatchObject({
      user_id: account?.id,
      email,
      kind: "builder",
      active: true,
      contact_person: "Meena Raj",
      website: "https://kadalhomes.example",
    });
    expect(record.data?.invited_at).not.toBeNull();
    const roles = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", account?.id ?? "");
    expect(roles.data?.map((row) => row.role).sort()).toEqual(["builder", "customer"]);
    // Nobody has signed in yet.
    expect(await store.readBuilder(builderId)).toEqual({
      id: builderId,
      active: true,
      signedIn: false,
    });
  });

  it("makes the person a builder when they sign in, and takes the portal away when deactivated", async () => {
    const email = emailFor("two");
    const { builderId } = await inviteBuilder(store, details(email, { kind: "agent" }));
    madeBuilders.push(builderId);
    const client = await signInAs(email);
    const session = await loadSessionView(client as Parameters<typeof loadSessionView>[0]);
    expect(session?.roles).toEqual(["builder", "customer"]);
    expect(session?.builderId).toBe(builderId);
    expect(session?.phoneVerified).toBe(false);
    // Signed in once: no longer waiting for an invitation.
    expect(await store.readBuilder(builderId)).toMatchObject({ signedIn: true });
    expect((await failureOf(() => resendInvitation(store, { builderId }))).code).toBe("CONFLICT");

    await setBuilderActive(store, { builderId, active: false });
    const after = await loadSessionView(client as Parameters<typeof loadSessionView>[0]);
    expect(after?.builderId).toBeNull();
    await setBuilderActive(store, { builderId, active: true });
    const again = await loadSessionView(client as Parameters<typeof loadSessionView>[0]);
    expect(again?.builderId).toBe(builderId);
  });

  it("refuses the reserved administrator addresses, and leaves nothing behind", async () => {
    for (const address of ["support@drizzlemarketings.com", "developer@findsprop.com"]) {
      const error = await failureOf(() => inviteBuilder(store, details(address)));
      expect(error.code).toBe("VALIDATION");
      expect(error.fieldErrors).toHaveProperty("email");
      const left = await admin.from("builders").select("id").ilike("email", address);
      expect(left.data).toEqual([]);
    }
  });

  it("refuses a second invitation to the same email, in any case, and an email that already has an account", async () => {
    const email = emailFor("three");
    const first = await inviteBuilder(store, details(email));
    madeBuilders.push(first.builderId);
    const again = await failureOf(() =>
      inviteBuilder(store, details(email.toUpperCase().replace("EXAMPLE.TEST", "example.test"))),
    );
    expect(again.fieldErrors).toHaveProperty("email");

    const taken = emailFor("four");
    const created = await admin.auth.admin.createUser({ email: taken, email_confirm: true });
    expect(created.error).toBeNull();
    const refused = await failureOf(() => inviteBuilder(store, details(taken)));
    expect(refused.fieldErrors).toHaveProperty("email");
    // The record made first was taken away again.
    const left = await admin.from("builders").select("id").ilike("email", taken);
    expect(left.data).toEqual([]);
  });

  it("resends the invitation to a builder who has not signed in, and refuses an inactive one", async () => {
    const email = emailFor("five");
    const { builderId } = await inviteBuilder(store, details(email));
    madeBuilders.push(builderId);
    const before = await admin.from("builders").select("invited_at").eq("id", builderId).single();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await resendInvitation(store, { builderId });
    const after = await admin.from("builders").select("invited_at").eq("id", builderId).single();
    expect(Date.parse(after.data?.invited_at ?? "")).toBeGreaterThan(
      Date.parse(before.data?.invited_at ?? ""),
    );
    await setBuilderActive(store, { builderId, active: false });
    expect((await failureOf(() => resendInvitation(store, { builderId }))).code).toBe("CONFLICT");
    expect((await failureOf(() => resendInvitation(store, { builderId: randomUUID() }))).code).toBe(
      "NOT_FOUND",
    );
  });

  it("saves a builder's details and type, records the change, and finds nothing for an unknown id", async () => {
    const email = emailFor("six");
    const { builderId } = await inviteBuilder(store, details(email));
    madeBuilders.push(builderId);
    await updateBuilderDetails(store, {
      builderId,
      name: `Kadal Homes Group ${RUN}`,
      kind: "agent",
      phone: "+919841055512",
      description: "Ready-to-move apartments in west Chennai.",
    });
    const record = await admin.from("builders").select("*").eq("id", builderId).single();
    expect(record.data).toMatchObject({
      name: `Kadal Homes Group ${RUN}`,
      kind: "agent",
      phone: "+919841055512",
      email,
    });
    const audit = await admin
      .from("audit_log")
      .select("action, diff")
      .eq("entity_id", builderId)
      .eq("action", "builder.kind_changed");
    expect(audit.data).toHaveLength(1);
    expect(
      (
        await failureOf(() =>
          updateBuilderDetails(store, {
            builderId: randomUUID(),
            name: "Nobody Homes",
            kind: "builder",
          }),
        )
      ).code,
    ).toBe("NOT_FOUND");
  });

  it("lets a signed-in builder save their own profile, and never the email, the type or another builder's record (S7-T03)", async () => {
    const email = emailFor("profile");
    const { builderId } = await inviteBuilder(store, details(email));
    madeBuilders.push(builderId);
    const other = await inviteBuilder(store, details(emailFor("profile-other")));
    madeBuilders.push(other.builderId);
    const client = await signInAs(email);

    const done = await saveMyProfile(client, {
      name: `Kadal Group ${RUN}`,
      phone: "+919841055512",
      description: "Mid-rise apartments.",
    });
    expect(done).toEqual({ builderId });
    const record = await admin.from("builders").select("*").eq("id", builderId).single();
    expect(record.data).toMatchObject({
      name: `Kadal Group ${RUN}`,
      phone: "+919841055512",
      description: "Mid-rise apartments.",
      contact_person: null,
      email,
      kind: "builder",
      active: true,
    });

    // The columns that are the admin's are closed to the builder, whatever is asked of the table directly.
    const kind = await client.from("builders").update({ kind: "agent" }).eq("id", builderId);
    expect(kind.error).not.toBeNull();
    const mail = await client
      .from("builders")
      .update({ email: "x@example.test" })
      .eq("id", builderId);
    expect(mail.error).not.toBeNull();
    // Another builder's record changes nothing: the policy lets a builder update only their own row.
    const theirs = await client
      .from("builders")
      .update({ name: "Hijacked" })
      .eq("id", other.builderId)
      .select("id");
    expect(theirs.data ?? []).toEqual([]);
    const untouched = await admin
      .from("builders")
      .select("name")
      .eq("id", other.builderId)
      .single();
    expect(untouched.data?.name).not.toBe("Hijacked");
  });

  it("records the invitation, the deactivation and the activation in the audit log, without the email", async () => {
    const email = emailFor("seven");
    const { builderId } = await inviteBuilder(store, details(email));
    madeBuilders.push(builderId);
    await setBuilderActive(store, { builderId, active: false });
    await setBuilderActive(store, { builderId, active: true });
    const { data } = await admin
      .from("audit_log")
      .select("action, diff")
      .eq("entity_id", builderId)
      .order("at", { ascending: true });
    const actions = data?.map((row) => row.action) ?? [];
    expect(actions).toEqual(
      expect.arrayContaining(["builder.created", "builder.deactivated", "builder.activated"]),
    );
    expect(JSON.stringify(data)).not.toContain(email);
  });
});
