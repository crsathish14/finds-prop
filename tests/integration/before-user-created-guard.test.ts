import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { adminClient, visitorClient } from "./support/clients";
import { removeTestUser, signInTestCustomer } from "./support/users";

/**
 * Supabase Auth calls hook_before_user_created just before it creates an account (BR-16). The
 * function's rules are covered by pgTAP; these tests show the real Auth service calls it and
 * honours the answer. The local stack has no Google credentials and email sign-up is off, so the
 * stranger-with-Google and email cases are reached only on dev (docs/runbooks/before-user-created-hook.md).
 */
const created: string[] = [];

afterAll(async () => {
  const admin = adminClient();
  for (const id of created) await admin.auth.admin.deleteUser(id);
  await removeTestUser();
});

async function anonymousUserCount(): Promise<number> {
  const { data, error } = await adminClient().auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error("Could not list users");
  return data.users.filter((user) => user.is_anonymous).length;
}

describe("IT-before-user-created: the real Auth service and the guard", () => {
  it("lets a phone sign-up through (and so proves the hook address is right: a wrong one fails every sign-up)", async () => {
    const customer = await signInTestCustomer();
    const { data, error } = await customer.client.auth.getUser();
    expect(error).toBeNull();
    expect(data.user?.id).toBe(customer.userId);
  });

  it("refuses an anonymous sign-in and leaves no account behind", async () => {
    const before = await anonymousUserCount();
    const { data, error } = await visitorClient().auth.signInAnonymously();
    expect(error).not.toBeNull();
    expect(error?.status).toBeGreaterThanOrEqual(400);
    expect(error?.status).toBeLessThan(500);
    expect(data.session).toBeNull();
    expect(await anonymousUserCount()).toBe(before);
  });

  it("does not block an account made by an administrator (the invitation flow needs this)", async () => {
    const { data, error } = await adminClient().auth.admin.createUser({
      email: `it-guard-${randomUUID()}@example.test`,
      email_confirm: true,
    });
    expect(error).toBeNull();
    if (data.user) created.push(data.user.id);
    expect(data.user?.id).toBeTruthy();
  });
});
