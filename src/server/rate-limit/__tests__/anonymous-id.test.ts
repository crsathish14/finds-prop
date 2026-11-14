import { describe, expect, it, vi } from "vitest";
import {
  anonymousIdCookieOptions,
  ensureAnonymousId,
  newAnonymousId,
  readAnonymousId,
  type AnonymousIdCookieJar,
} from "@/server/rate-limit/anonymous-id";

function jarWith(value?: string) {
  const set = vi.fn();
  const jar: AnonymousIdCookieJar = {
    get: (name) => (name === "fp_ai_anon" && value !== undefined ? { value } : undefined),
    set,
  };
  return { jar, set };
}

describe("UT-anonymous-id: the anonymous cookie id (D13)", () => {
  it("UT-cookie-random: makes a long random URL-safe id, a different one each time", () => {
    const first = newAnonymousId();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newAnonymousId()).not.toBe(first);
  });

  it("UT-cookie-attributes: is HttpOnly, SameSite Lax, on the whole site, for a year, and Secure when deployed", () => {
    expect(anonymousIdCookieOptions(true)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
    expect(anonymousIdCookieOptions(false).secure).toBe(false);
    expect(anonymousIdCookieOptions(false).httpOnly).toBe(true);
  });

  it("UT-cookie-set-on-first-message: sets a new id with those attributes when the browser has none", () => {
    const { jar, set } = jarWith();
    const result = ensureAnonymousId(jar, { secure: true });
    expect(result.created).toBe(true);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith("fp_ai_anon", result.id, anonymousIdCookieOptions(true));
  });

  it("UT-cookie-kept: keeps the id the browser already has and sets nothing", () => {
    const existing = newAnonymousId();
    const { jar, set } = jarWith(existing);
    expect(ensureAnonymousId(jar, { secure: true })).toEqual({ id: existing, created: false });
    expect(set).not.toHaveBeenCalled();
  });

  it("UT-cookie-forged: ignores a value that is not one of ours and issues a new id", () => {
    for (const forged of ["", "short", "x".repeat(44), "../../etc/passwd", `${"a".repeat(42)}!`]) {
      expect(readAnonymousId(jarWith(forged).jar)).toBeNull();
    }
    const { jar, set } = jarWith("short");
    const result = ensureAnonymousId(jar, { secure: false });
    expect(result.created).toBe(true);
    expect(result.id).not.toBe("short");
    expect(set).toHaveBeenCalledTimes(1);
  });
});
