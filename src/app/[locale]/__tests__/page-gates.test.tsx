import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionView } from "@/server/auth/session";

const visitor = vi.hoisted(() => ({
  session: null as SessionView | null,
  returnPath: null as string | null,
}));

// redirect() ends rendering by throwing in Next.js; here the throw carries the destination.
vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    throw new Error(`REDIRECT ${destination}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers(visitor.returnPath ? { "x-return-path": visitor.returnPath } : {}),
}));
vi.mock("@/server/auth/get-session-view", () => ({ getSessionView: async () => visitor.session }));

const { PageGate } = await import("../_components/page-gate");
const { SignedInRedirect } = await import("../_components/signed-in-redirect");

const customer: SessionView = {
  userId: "user-1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};
const builder: SessionView = { ...customer, roles: ["builder", "customer"], builderId: "record-1" };
const agent: SessionView = {
  ...customer,
  roles: ["agent", "builder", "customer"],
  builderId: "record-2",
};
const admin: SessionView = { ...customer, roles: ["super_admin", "customer"] };

const people = { signedOut: null, customer, builder, agent, admin } as const;
type Person = keyof typeof people;

/** Where each kind of visitor ends up on a guarded area: "stays" or the redirect destination. */
const EXPECTED = {
  customer: {
    signedOut: "/auth?redirect=%2Fdashboard",
    customer: "stays",
    builder: "stays",
    agent: "stays",
    admin: "stays",
  },
  builder: {
    signedOut: "/builder/login",
    customer: "/builder/login?denied=1",
    builder: "stays",
    agent: "stays",
    admin: "/builder/login?denied=1",
  },
  admin: {
    signedOut: "/admin/login",
    customer: "/",
    builder: "/",
    agent: "/",
    admin: "stays",
  },
} as const;

async function outcome(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "stays";
  } catch (error) {
    return error instanceof Error ? error.message.replace("REDIRECT ", "") : "unknown";
  }
}

describe("UT-page-gate: a route group's layout sends each visitor to the right place", () => {
  beforeEach(() => {
    visitor.session = null;
    visitor.returnPath = "/dashboard";
  });

  for (const area of ["customer", "builder", "admin"] as const) {
    for (const person of Object.keys(people) as Person[]) {
      it(`${area} area, ${person}: ${EXPECTED[area][person]}`, async () => {
        visitor.session = people[person];
        const result = await outcome(() => PageGate({ area, children: "content" }));
        expect(result).toBe(EXPECTED[area][person]);
      });
    }
  }

  it("renders the page only for a visitor who may see it", async () => {
    visitor.session = admin;
    expect(await PageGate({ area: "admin", children: "content" })).toBe("content");
  });

  it("sends a signed-out customer back to the page they asked for, query included", async () => {
    visitor.returnPath = "/post-property?step=2";
    expect(await outcome(() => PageGate({ area: "customer", children: null }))).toBe(
      "/auth?redirect=%2Fpost-property%3Fstep%3D2",
    );
  });

  it("falls back to the home page when no safe return address is known", async () => {
    visitor.returnPath = "//evil.example";
    expect(await outcome(() => PageGate({ area: "customer", children: null }))).toBe(
      "/auth?redirect=%2F",
    );
    visitor.returnPath = null;
    expect(await outcome(() => PageGate({ area: "customer", children: null }))).toBe(
      "/auth?redirect=%2F",
    );
  });
});

describe("UT-signed-in-redirect: sign-in pages for visitors who are already in", () => {
  beforeEach(() => {
    visitor.session = null;
  });

  it("shows the sign-in page to a signed-out visitor", async () => {
    expect(await SignedInRedirect({ area: "customer", destination: "/dashboard" })).toBeNull();
  });

  it("sends a signed-in visitor on to the destination", async () => {
    visitor.session = customer;
    expect(
      await outcome(() => SignedInRedirect({ area: "customer", destination: "/dashboard" })),
    ).toBe("/dashboard");
    visitor.session = builder;
    expect(
      await outcome(() => SignedInRedirect({ area: "builder", destination: "/builder/dashboard" })),
    ).toBe("/builder/dashboard");
    visitor.session = admin;
    expect(
      await outcome(() => SignedInRedirect({ area: "admin", destination: "/admin/dashboard" })),
    ).toBe("/admin/dashboard");
  });

  it("keeps showing a staff sign-in page to a visitor with no access to that area", async () => {
    visitor.session = customer;
    expect(
      await SignedInRedirect({ area: "builder", destination: "/builder/dashboard" }),
    ).toBeNull();
    expect(await SignedInRedirect({ area: "admin", destination: "/admin/dashboard" })).toBeNull();
    visitor.session = builder;
    expect(await SignedInRedirect({ area: "admin", destination: "/admin/dashboard" })).toBeNull();
  });
});
