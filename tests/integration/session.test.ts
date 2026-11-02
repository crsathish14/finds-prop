import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { loadSessionView } from "@/server/auth/get-session-view";
import { adminClient, visitorClient, type TestClient } from "./support/clients";
import {
  createBuilderRecord,
  grantRole,
  removeTestUser,
  signInTestCustomer,
  type TestUser,
} from "./support/users";

// The app builds this client from cookies; the test uses the same kind of client signed in directly.
const read = (client: TestClient) =>
  loadSessionView(client as Parameters<typeof loadSessionView>[0]);

describe("IT-session: who is signed in, from a real token and the user's own rows", () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await signInTestCustomer();
  });

  // Roles are read live, so each test starts from a plain customer again.
  afterEach(async () => {
    const admin = adminClient();
    await admin.from("user_roles").delete().eq("user_id", user.userId).neq("role", "customer");
    await admin.from("builders").delete().eq("user_id", user.userId);
  });

  afterAll(removeTestUser);

  it("sees nobody when there is no session", async () => {
    expect(await read(visitorClient())).toBeNull();
  });

  it("sees a new phone sign-in as a customer with a verified phone and no builder record", async () => {
    expect(await read(user.client)).toEqual({
      userId: user.userId,
      roles: ["customer"],
      phoneVerified: true,
      builderId: null,
    });
  });

  it("gives an active builder their builder record", async () => {
    await grantRole(user.userId, "builder");
    const builderId = await createBuilderRecord(user.userId, { active: true });
    const view = await read(user.client);
    expect(view?.roles).toEqual(["builder", "customer"]);
    expect(view?.builderId).toBe(builderId);
  });

  it("gives a deactivated builder no builder record, so access ends at once (BR-34)", async () => {
    await grantRole(user.userId, "builder");
    await createBuilderRecord(user.userId, { active: false });
    const view = await read(user.client);
    expect(view?.roles).toContain("builder");
    expect(view?.builderId).toBeNull();
  });

  it("gives no builder record to someone who has the record but not the role", async () => {
    await createBuilderRecord(user.userId, { active: true });
    const view = await read(user.client);
    expect(view?.roles).toEqual(["customer"]);
    expect(view?.builderId).toBeNull();
  });

  it("shows an agent's role, and takes it away as soon as it is removed", async () => {
    await grantRole(user.userId, "agent");
    expect((await read(user.client))?.roles).toContain("agent");

    await adminClient().from("user_roles").delete().eq("user_id", user.userId).eq("role", "agent");
    expect((await read(user.client))?.roles).toEqual(["customer"]);
  });

  it("never gives the administrator role to an ordinary account, even through the service role (BR-11)", async () => {
    await expect(grantRole(user.userId, "super_admin")).rejects.toThrow(/super_admin/);
    expect((await read(user.client))?.roles).toEqual(["customer"]);
  });

  it("cannot be talked into a role by the signed-in user themselves", async () => {
    const attempt = await user.client
      .from("user_roles")
      .insert({ user_id: user.userId, role: "builder" });
    expect(attempt.error).not.toBeNull();
    expect((await read(user.client))?.roles).toEqual(["customer"]);
  });
});
