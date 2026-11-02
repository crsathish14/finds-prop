import { describe, expect, it } from "vitest";
import { createLogger } from "@/server/logger";
import type { SessionView } from "@/server/auth/session";
import {
  handleStaffCallback,
  type StaffCallbackDeps,
  type StaffCallbackQuery,
} from "@/server/auth/staff-callback";

const customer: SessionView = {
  userId: "00000000-0000-4000-8000-0000000000c1",
  roles: ["customer"],
  phoneVerified: false,
  builderId: null,
};
const builder: SessionView = {
  ...customer,
  userId: "00000000-0000-4000-8000-0000000000b1",
  roles: ["customer", "builder"],
  builderId: "builder-record-1",
};
const admin: SessionView = {
  ...customer,
  userId: "00000000-0000-4000-8000-0000000000a1",
  roles: ["customer", "super_admin"],
};

const CODE = "one-time-code-value-123";

const query = (overrides: Partial<StaffCallbackQuery> = {}): StaffCallbackQuery => ({
  code: CODE,
  error: null,
  errorDescription: null,
  area: "builder",
  next: null,
  ...overrides,
});

function harness(
  options: {
    session?: SessionView | null;
    exchangeError?: unknown;
    exchangeThrows?: boolean;
    readThrows?: boolean;
    auditThrows?: boolean;
    signOutThrows?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const audits: { action: string; userId: string }[] = [];
  const lines: string[] = [];
  const deps: StaffCallbackDeps = {
    exchangeCode: (code) => {
      calls.push(`exchange:${code}`);
      if (options.exchangeThrows) return Promise.reject(new Error("network"));
      return Promise.resolve({ error: options.exchangeError ?? null });
    },
    readSession: () => {
      calls.push("read");
      if (options.readThrows) return Promise.reject(new Error("roles unreadable"));
      return Promise.resolve(options.session === undefined ? builder : options.session);
    },
    signOut: () => {
      calls.push("signOut");
      return options.signOutThrows ? Promise.reject(new Error("no")) : Promise.resolve();
    },
    audit: ({ action, session }) => {
      calls.push(`audit:${action}`);
      audits.push({ action, userId: session.userId });
      return options.auditThrows ? Promise.reject(new Error("audit down")) : Promise.resolve();
    },
    log: createLogger({}, { level: "debug", write: (line) => lines.push(line) }),
  };
  return { deps, calls, audits, lines };
}

describe("UT-staff-callback: a successful sign-in (S3-T10)", () => {
  it("sends an active builder to the builder dashboard and records the sign-in", async () => {
    const { deps, calls, audits } = harness();
    await expect(handleStaffCallback(query(), deps)).resolves.toBe("/builder/dashboard");
    expect(calls).toEqual([`exchange:${CODE}`, "read", "audit:staff.signed_in"]);
    expect(audits).toEqual([{ action: "staff.signed_in", userId: builder.userId }]);
  });

  it("sends the administrator to the admin dashboard", async () => {
    const { deps } = harness({ session: admin });
    await expect(handleStaffCallback(query({ area: "admin" }), deps)).resolves.toBe(
      "/admin/dashboard",
    );
  });

  it("goes back to a safe page inside the area, and ignores any other", async () => {
    const { deps } = harness();
    await expect(handleStaffCallback(query({ next: "/builder/leads" }), deps)).resolves.toBe(
      "/builder/leads",
    );
    await expect(handleStaffCallback(query({ next: "https://evil.example" }), deps)).resolves.toBe(
      "/builder/dashboard",
    );
    await expect(handleStaffCallback(query({ next: "/admin/dashboard" }), deps)).resolves.toBe(
      "/builder/dashboard",
    );
  });

  it("still signs the builder in when the history entry cannot be written", async () => {
    const { deps, lines } = harness({ auditThrows: true });
    await expect(handleStaffCallback(query(), deps)).resolves.toBe("/builder/dashboard");
    expect(lines.some((line) => line.includes("audit entry failed"))).toBe(true);
  });
});

describe("UT-staff-callback: a visitor who is not eligible", () => {
  it("signs out a customer at the builder page, records it and says only 'denied'", async () => {
    const { deps, calls, audits } = harness({ session: customer });
    await expect(handleStaffCallback(query(), deps)).resolves.toBe("/builder/login?denied=1");
    expect(calls).toEqual([`exchange:${CODE}`, "read", "audit:staff.sign_in_denied", "signOut"]);
    expect(audits).toEqual([{ action: "staff.sign_in_denied", userId: customer.userId }]);
  });

  it("refuses a builder at the admin page and the administrator at the builder page", async () => {
    const asBuilder = harness({ session: builder });
    await expect(handleStaffCallback(query({ area: "admin" }), asBuilder.deps)).resolves.toBe(
      "/admin/login?denied=1",
    );
    const asAdmin = harness({ session: admin });
    await expect(handleStaffCallback(query({ area: "builder" }), asAdmin.deps)).resolves.toBe(
      "/builder/login?denied=1",
    );
  });

  it("refuses a builder whose record is no longer active", async () => {
    const deactivated: SessionView = { ...builder, builderId: null };
    const { deps } = harness({ session: deactivated });
    await expect(handleStaffCallback(query(), deps)).resolves.toBe("/builder/login?denied=1");
  });

  it("is not fooled by an area or next address that claims more than the account has", async () => {
    const { deps } = harness({ session: customer });
    await expect(
      handleStaffCallback(query({ area: "admin", next: "/admin/dashboard" }), deps),
    ).resolves.toBe("/admin/login?denied=1");
  });

  it("still answers when ending the session fails", async () => {
    const { deps } = harness({ session: customer, signOutThrows: true });
    await expect(handleStaffCallback(query(), deps)).resolves.toBe("/builder/login?denied=1");
  });
});

describe("UT-staff-callback: what Supabase reports before any code exists", () => {
  it("sends the guard's refusal (a stranger with Google) back as denied, without exchanging", async () => {
    const { deps, calls } = harness();
    await expect(
      handleStaffCallback(
        query({ code: null, error: "server_error", errorDescription: "signup_not_allowed" }),
        deps,
      ),
    ).resolves.toBe("/builder/login?denied=1");
    expect(calls).toEqual([]);
  });

  it("sends a cancelled Google screen back as cancelled", async () => {
    const { deps, calls } = harness();
    await expect(
      handleStaffCallback(
        query({ code: null, error: "access_denied", errorDescription: "The user denied access" }),
        deps,
      ),
    ).resolves.toBe("/builder/login?cancelled=1");
    expect(calls).toEqual([]);
  });

  it("returns to the page of the area the sign-in started from", async () => {
    const { deps } = harness();
    await expect(
      handleStaffCallback(
        query({ area: "admin", code: null, error: "access_denied", errorDescription: "x" }),
        deps,
      ),
    ).resolves.toBe("/admin/login?cancelled=1");
  });

  it("treats any other reported error as an error", async () => {
    const { deps } = harness();
    await expect(
      handleStaffCallback(
        query({ code: null, error: "server_error", errorDescription: "Database error" }),
        deps,
      ),
    ).resolves.toBe("/builder/login?error=1");
  });
});

describe("UT-staff-callback: when something is missing or fails", () => {
  it("refuses a callback with no code", async () => {
    const { deps, calls } = harness();
    await expect(handleStaffCallback(query({ code: null }), deps)).resolves.toBe(
      "/builder/login?error=1",
    );
    expect(calls).toEqual([]);
  });

  it("refuses a callback with no known area, and exchanges nothing", async () => {
    const { deps, calls } = harness();
    for (const area of [null, "customer", "ADMIN", ""]) {
      await expect(handleStaffCallback(query({ area }), deps)).resolves.toBe(
        "/builder/login?error=1",
      );
    }
    expect(calls).toEqual([]);
  });

  it("reports an error when the code cannot be exchanged", async () => {
    const refused = harness({ exchangeError: { message: "invalid grant" } });
    await expect(handleStaffCallback(query(), refused.deps)).resolves.toBe(
      "/builder/login?error=1",
    );
    expect(refused.calls).toEqual([`exchange:${CODE}`]);
    const crashed = harness({ exchangeThrows: true });
    await expect(handleStaffCallback(query(), crashed.deps)).resolves.toBe(
      "/builder/login?error=1",
    );
  });

  it("signs out and reports an error when the new session cannot be read", async () => {
    const { deps, calls } = harness({ readThrows: true });
    await expect(handleStaffCallback(query(), deps)).resolves.toBe("/builder/login?error=1");
    expect(calls).toEqual([`exchange:${CODE}`, "read", "signOut"]);
  });

  it("treats a missing session after the exchange as an error, not a denial", async () => {
    const { deps, calls } = harness({ session: null });
    await expect(handleStaffCallback(query(), deps)).resolves.toBe("/builder/login?error=1");
    expect(calls).toEqual([`exchange:${CODE}`, "read", "signOut"]);
  });
});

describe("UT-staff-callback: privacy", () => {
  it("never writes the code to the log, in any outcome", async () => {
    const outcomes = [
      harness(),
      harness({ session: customer }),
      harness({ exchangeError: { message: CODE } }),
      harness({ readThrows: true }),
    ];
    for (const { deps, lines } of outcomes) {
      await handleStaffCallback(query(), deps);
      expect(lines.join("\n")).not.toContain(CODE);
    }
  });

  it("only ever answers with one of our own paths", async () => {
    const answers: string[] = [];
    for (const next of [null, "//evil.example", "https://evil.example", "/builder/leads"]) {
      answers.push(await handleStaffCallback(query({ next }), harness().deps));
    }
    for (const answer of answers) expect(answer.startsWith("/")).toBe(true);
    for (const answer of answers) expect(answer.startsWith("//")).toBe(false);
  });
});
