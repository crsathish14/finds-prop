import { describe, expect, it, vi } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import {
  inviteBuilder,
  mapBuilderError,
  resendInvitation,
  setBuilderActive,
  toBuilderRow,
  updateBuilderDetails,
  type BuilderState,
  type BuilderStore,
} from "../builder-service";
import type { InviteBuilderInput } from "../schemas";

const BUILDER = "00000000-0000-4000-b000-000000000001";
const USER = "00000000-0000-4000-8000-0000000000b1";

const invitation: InviteBuilderInput = {
  name: "Kadal Homes",
  email: "sales@kadalhomes.example",
  kind: "builder",
  contactPerson: "Meena Raj",
  website: "https://kadalhomes.example",
};

function store(overrides: Partial<BuilderStore> = {}) {
  const calls: string[] = [];
  const made: BuilderStore = {
    insertBuilder: vi.fn(async () => (calls.push("insertBuilder"), BUILDER)),
    createAccount: vi.fn(async () => (calls.push("createAccount"), USER)),
    linkAccount: vi.fn(async () => void calls.push("linkAccount")),
    discard: vi.fn(async () => void calls.push("discard")),
    readBuilder: vi.fn(async (): Promise<BuilderState | null> => ({
      id: BUILDER,
      active: true,
      signedIn: false,
    })),
    stampInvitation: vi.fn(async () => void calls.push("stampInvitation")),
    setActive: vi.fn(async () => true),
    updateDetails: vi.fn(async () => true),
    ...overrides,
  };
  return { made, calls };
}

describe("UT-builder-service: inviting a builder, the saga (S7-T05, ADR-010)", () => {
  it("adds the record first, then the account, then ties them together, and keeps all three", async () => {
    const { made, calls } = store();
    expect(await inviteBuilder(made, invitation)).toEqual({ builderId: BUILDER });
    expect(calls).toEqual(["insertBuilder", "createAccount", "linkAccount"]);
    expect(made.linkAccount).toHaveBeenCalledWith(BUILDER, USER);
    expect(made.discard).not.toHaveBeenCalled();
  });

  it("gives the record the details and the email, with a box left empty as no value", async () => {
    const { made } = store();
    await inviteBuilder(made, invitation);
    expect(made.insertBuilder).toHaveBeenCalledWith({
      name: "Kadal Homes",
      kind: "builder",
      contact_person: "Meena Raj",
      phone: null,
      logo_url: null,
      website: "https://kadalhomes.example",
      description: null,
      email: "sales@kadalhomes.example",
    });
    expect(made.createAccount).toHaveBeenCalledWith("sales@kadalhomes.example");
  });

  it("stops at the record, and makes no account, when the database refuses it (the reserved address, a second record)", async () => {
    const refusal = mapBuilderError({ message: "builders.reserved_email" });
    const { made } = store({ insertBuilder: vi.fn().mockRejectedValue(refusal) });
    await expect(inviteBuilder(made, invitation)).rejects.toBe(refusal);
    expect(made.createAccount).not.toHaveBeenCalled();
    expect(made.discard).not.toHaveBeenCalled();
  });

  it("takes the record away again when the account cannot be made, so the invitation can be tried again", async () => {
    const refusal = mapBuilderError({ code: "email_exists" });
    const { made } = store({ createAccount: vi.fn().mockRejectedValue(refusal) });
    await expect(inviteBuilder(made, invitation)).rejects.toBe(refusal);
    expect(made.discard).toHaveBeenCalledWith(BUILDER, null);
    expect(made.linkAccount).not.toHaveBeenCalled();
  });

  it("takes both the record and the account away when tying them together fails", async () => {
    const failure = new ActionError("INTERNAL", "The builder could not be saved");
    const { made } = store({ linkAccount: vi.fn().mockRejectedValue(failure) });
    await expect(inviteBuilder(made, invitation)).rejects.toBe(failure);
    expect(made.discard).toHaveBeenCalledWith(BUILDER, USER);
  });
});

describe("UT-builder-service: resending an invitation (S7-T05)", () => {
  it("stamps the invitation again for an active builder who has not signed in", async () => {
    const { made } = store();
    expect(await resendInvitation(made, { builderId: BUILDER })).toEqual({ builderId: BUILDER });
    expect(made.stampInvitation).toHaveBeenCalledWith(BUILDER);
  });

  it("finds nothing for a builder that does not exist", async () => {
    const { made } = store({ readBuilder: vi.fn(async () => null) });
    await expect(resendInvitation(made, { builderId: BUILDER })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(made.stampInvitation).not.toHaveBeenCalled();
  });

  it.each([
    ["has signed in already", { id: BUILDER, active: true, signedIn: true }],
    ["is inactive", { id: BUILDER, active: false, signedIn: false }],
  ])("refuses a builder who %s", async (_why, state) => {
    const { made } = store({ readBuilder: vi.fn(async () => state) });
    await expect(resendInvitation(made, { builderId: BUILDER })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(made.stampInvitation).not.toHaveBeenCalled();
  });
});

describe("UT-builder-service: activating, deactivating and editing (S7-T05)", () => {
  it("activates and deactivates, answering the new state", async () => {
    const { made } = store();
    expect(await setBuilderActive(made, { builderId: BUILDER, active: false })).toEqual({
      builderId: BUILDER,
      active: false,
    });
    expect(made.setActive).toHaveBeenCalledWith(BUILDER, false);
  });

  it("finds nothing to change for a builder that does not exist", async () => {
    const { made } = store({
      setActive: vi.fn(async () => false),
      updateDetails: vi.fn(async () => false),
    });
    await expect(
      setBuilderActive(made, { builderId: BUILDER, active: true }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      updateBuilderDetails(made, { builderId: BUILDER, ...invitation }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("saves the details without the email", async () => {
    const { made } = store();
    const details = {
      name: invitation.name,
      kind: invitation.kind,
      contactPerson: invitation.contactPerson,
      website: invitation.website,
    };
    await updateBuilderDetails(made, { builderId: BUILDER, ...details });
    expect(made.updateDetails).toHaveBeenCalledWith(BUILDER, toBuilderRow(details));
  });
});

describe("UT-builder-errors: what the database and the auth service raise, as action errors (S7-T05)", () => {
  it("puts the reserved admin address and a taken email on the email box, in the owner's words", () => {
    expect(mapBuilderError({ message: "builders.reserved_email" })).toMatchObject({
      code: "VALIDATION",
      fieldErrors: { email: [{ key: "validation.builderEmailReserved" }] },
    });
    for (const failure of [
      { code: "23505" },
      { code: "email_exists" },
      { code: "user_already_exists" },
    ]) {
      expect(mapBuilderError(failure)).toMatchObject({
        code: "VALIDATION",
        fieldErrors: { email: [{ key: "validation.emailTaken" }] },
      });
    }
  });

  it("refuses what only the system may change, and answers anything else as ours", () => {
    expect(mapBuilderError({ message: "builders.admin_only_columns" }).code).toBe("FORBIDDEN");
    expect(mapBuilderError({ code: "42501" }).code).toBe("FORBIDDEN");
    expect(mapBuilderError({ code: "XX000" }).code).toBe("INTERNAL");
    expect(mapBuilderError({}).code).toBe("INTERNAL");
  });
});
