import { describe, expect, it } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { revealContact } from "../contact-service";

const store = (answer: { phone: string | null; errorCode?: string }) => ({
  readPhone: () => Promise.resolve(answer),
});

describe("revealContact", () => {
  it("gives the number the database gave", async () => {
    await expect(revealContact(store({ phone: "+919100000011" }), "id")).resolves.toEqual({
      phone: "+919100000011",
    });
  });

  it("answers FORBIDDEN when the database refuses the caller", async () => {
    await expect(
      revealContact(store({ phone: null, errorCode: "42501" }), "id"),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("answers NOT_FOUND when there is no number and INTERNAL for any other failure", async () => {
    await expect(revealContact(store({ phone: null }), "id")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const failure = revealContact(store({ phone: null, errorCode: "XX000" }), "id");
    await expect(failure).rejects.toBeInstanceOf(ActionError);
    await expect(failure).rejects.toMatchObject({ code: "INTERNAL" });
  });
});
