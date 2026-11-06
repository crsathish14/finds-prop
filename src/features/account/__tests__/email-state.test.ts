import { describe, expect, it } from "vitest";
import { emailStateFrom } from "../email-state";

describe("emailStateFrom: where the email stands (ADD-03)", () => {
  it("is none when the account has no address at all", () => {
    expect(emailStateFrom({ email: null, confirmedAt: null, pendingEmail: null })).toEqual({
      kind: "none",
    });
    expect(emailStateFrom({ email: "", confirmedAt: undefined, pendingEmail: "  " })).toEqual({
      kind: "none",
    });
  });

  it("is pending when a link went to an address that is not confirmed", () => {
    expect(
      emailStateFrom({ email: "", confirmedAt: null, pendingEmail: "priya@example.com" }),
    ).toEqual({ kind: "pending", email: "priya@example.com" });
  });

  it("is pending for an address on the account that has no confirmation date", () => {
    expect(
      emailStateFrom({ email: "priya@example.com", confirmedAt: null, pendingEmail: null }),
    ).toEqual({ kind: "pending", email: "priya@example.com" });
  });

  it("is verified once the address was confirmed", () => {
    expect(
      emailStateFrom({
        email: "priya@example.com",
        confirmedAt: "2026-11-03T10:00:00Z",
        pendingEmail: null,
      }),
    ).toEqual({ kind: "verified", email: "priya@example.com" });
  });

  it("stays verified while a change to another address is waiting", () => {
    expect(
      emailStateFrom({
        email: "priya@example.com",
        confirmedAt: "2026-11-03T10:00:00Z",
        pendingEmail: "other@example.com",
      }),
    ).toEqual({ kind: "verified", email: "priya@example.com" });
  });

  it("prefers the address a link was sent to over an unconfirmed one on the account", () => {
    expect(
      emailStateFrom({
        email: "old@example.com",
        confirmedAt: null,
        pendingEmail: "new@example.com",
      }),
    ).toEqual({ kind: "pending", email: "new@example.com" });
  });
});
