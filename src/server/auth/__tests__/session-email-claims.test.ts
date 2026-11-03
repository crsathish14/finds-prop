import { describe, expect, it } from "vitest";
import { emailFromClaims } from "../session-email-claims";

describe("UT-session-email-claims: what the email page reads from the token (S3-T09)", () => {
  it("reads the email of a signed-in user", () => {
    expect(emailFromClaims({ sub: "user-1", email: "priya.raman@example.com" })).toEqual({
      signedIn: true,
      email: "priya.raman@example.com",
    });
  });

  it("is signed in with no email for a phone-only user", () => {
    expect(emailFromClaims({ sub: "user-1" })).toEqual({ signedIn: true, email: null });
    expect(emailFromClaims({ sub: "user-1", email: "" })).toEqual({ signedIn: true, email: null });
  });

  it.each([null, undefined, {}, { sub: "" }, { sub: 42 }, { email: "a@example.com" }])(
    "is signed out for %j, whatever email it carries",
    (claims) => {
      expect(emailFromClaims(claims)).toEqual({ signedIn: false, email: null });
    },
  );

  it("ignores an email that is not text", () => {
    expect(emailFromClaims({ sub: "user-1", email: 7 })).toEqual({ signedIn: true, email: null });
  });
});
