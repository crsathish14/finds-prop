// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  originOfPath,
  readEmailOrigin,
  rememberEmailOrigin,
  serverEmailOrigin,
} from "../email-origin";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("UT-email-origin: where the email link was asked for (ADR-195)", () => {
  it("answers the dashboard when nothing was remembered, and on the server", () => {
    expect(readEmailOrigin()).toBe("dashboard");
    expect(serverEmailOrigin()).toBe("dashboard");
  });

  it("remembers posting, and a later dashboard request replaces it", () => {
    rememberEmailOrigin("post");
    expect(readEmailOrigin()).toBe("post");
    rememberEmailOrigin("dashboard");
    expect(readEmailOrigin()).toBe("dashboard");
  });

  it("treats anything else that is stored as the dashboard", () => {
    window.localStorage.setItem("findsprop:email-origin:v1", "https://example.test/evil");
    expect(readEmailOrigin()).toBe("dashboard");
  });

  it("copes with storage that refuses to answer", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => rememberEmailOrigin("post")).not.toThrow();
    expect(readEmailOrigin()).toBe("dashboard");
  });

  it.each([
    ["/post-property", "post"],
    ["/post-property/abc", "post"],
    ["/post-propertyX", "dashboard"],
    ["/dashboard", "dashboard"],
    ["/properties/x", "dashboard"],
    ["", "dashboard"],
  ] as const)("maps the sign-in destination %j to %s", (path, origin) => {
    expect(originOfPath(path)).toBe(origin);
  });
});
