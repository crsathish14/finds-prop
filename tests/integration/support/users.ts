import { randomUUID } from "node:crypto";
import type { Database } from "@/types/database.types";
import { adminClient, visitorClient, type TestClient } from "./clients";

type AppRole = Database["public"]["Enums"]["app_role"];

/**
 * The local stack answers this number with a fixed code and sends no message (config.toml,
 * [auth.sms.test_otp]). It is a fictional number, the same kind the seeds use.
 */
const TEST_PHONE = "+919900000001";
const TEST_CODE = "123456";

export interface TestUser {
  userId: string;
  /** Signed in as this user, through the publishable key, so Row Level Security applies. */
  client: TestClient;
}

/** Removes the test user and everything hanging off it, so every test starts from nothing. */
export async function removeTestUser(): Promise<void> {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error("Could not list users to clean up");
  const existing = data.users.find((user) => user.phone === TEST_PHONE.slice(1));
  if (!existing) return;
  await admin.from("builders").delete().eq("user_id", existing.id);
  const { error: removeError } = await admin.auth.admin.deleteUser(existing.id);
  if (removeError) throw new Error("Could not delete the test user");
}

/**
 * Signs in a brand-new customer by phone code, the way the app does: ask for a code, then verify
 * it. The account starts with the customer role only; the helpers below add others.
 */
export async function signInTestCustomer(): Promise<TestUser> {
  await removeTestUser();
  const client = visitorClient();
  const asked = await client.auth.signInWithOtp({ phone: TEST_PHONE });
  if (asked.error)
    throw new Error(
      `Could not ask for a code (${asked.error.status ?? "no status"}, ${asked.error.code ?? "no code"}: ${asked.error.message})`,
    );
  const verified = await client.auth.verifyOtp({
    phone: TEST_PHONE,
    token: TEST_CODE,
    type: "sms",
  });
  const userId = verified.data.user?.id;
  if (verified.error || !userId) {
    throw new Error(
      `Could not verify the code (${verified.error?.status ?? "no user"}, ${verified.error?.code ?? "no code"}: ${verified.error?.message ?? "no message"})`,
    );
  }
  return { userId, client };
}

/** Gives a user a role. Roles are written by the service role only (BR-13). */
export async function grantRole(userId: string, role: AppRole): Promise<void> {
  const { error } = await adminClient().from("user_roles").insert({ user_id: userId, role });
  if (error) throw new Error(`Could not grant the ${role} role (${error.code})`);
}

/** Gives a user a builder record. The email is made up and unique, and ends in a reserved test domain. */
export async function createBuilderRecord(
  userId: string,
  options: { active: boolean },
): Promise<string> {
  const { data, error } = await adminClient()
    .from("builders")
    .insert({
      user_id: userId,
      email: `it-${randomUUID()}@example.test`,
      name: "Integration Test Builder",
      active: options.active,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not create the builder record (${error.code})`);
  return data.id;
}
