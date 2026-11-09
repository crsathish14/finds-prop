import { describe, expect, it } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import {
  saveFooterConfig,
  saveHeaderConfig,
  saveHeroConfig,
  saveHomepageConfig,
  saveSponsorsConfig,
} from "../action-config";

const admin: SessionView = {
  userId: "00000000-0000-4000-8000-0000000000ad",
  roles: ["customer", "super_admin"],
  phoneVerified: false,
  builderId: null,
};
const customer: SessionView = { ...admin, roles: ["customer"], phoneVerified: true };
const builder: SessionView = {
  ...admin,
  roles: ["customer", "builder"],
  builderId: "00000000-0000-4000-8000-0000000000b1",
};

function harness(options: { session?: SessionView | null; rateLimited?: boolean } = {}) {
  const calls: string[] = [];
  const deps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => Promise.resolve(options.session === undefined ? admin : options.session),
    rateLimit: ({ scope }) => {
      calls.push(`rateLimit:${scope}`);
      return options.rateLimited
        ? Promise.reject(new ActionError("RATE_LIMITED", "too many", { retryAfter: 600 }))
        : Promise.resolve();
    },
    beginIdempotent: () => {
      calls.push("begin");
      return Promise.resolve({ replay: false as const });
    },
    completeIdempotent: () => Promise.resolve(),
    releaseIdempotent: () => Promise.resolve(),
    invalidate: (tags) => {
      calls.push(`invalidate:${tags.join("|")}`);
    },
    audit: (event) => {
      calls.push(`audit:${event.action}`);
      return Promise.resolve();
    },
    log: createLogger({}, { write: () => undefined }),
  };
  const define = createDefineAction(deps);
  const handler = async () => {
    calls.push("handler");
    return { key: "hero" as const };
  };
  return {
    calls,
    header: define({ ...saveHeaderConfig, handler }),
    hero: define({ ...saveHeroConfig, handler }),
    homepage: define({ ...saveHomepageConfig, handler }),
    footer: define({ ...saveFooterConfig, handler }),
    sponsors: define({ ...saveSponsorsConfig, handler }),
  };
}

const validHeader = { links: [{ label: "Buy", href: "/properties" }] };
const validHero = { title: "Find a home", layout: "search_desk" };
const validHomepage = {
  showFeatured: true,
  showProjectTypes: true,
  showDiscovery: true,
  showWhyUs: true,
  showCta: true,
  localities: [],
};
const validFooter = { links: [] };
const validSponsors = { sponsors: [] };

describe("UT-site-content-actions: who may edit the site content, and what it refreshes (S7-T10)", () => {
  it("lets a super admin save any of the five: the admin_edit limit, the handler, the site content tag, no audit call (the database audits)", async () => {
    const { header, hero, homepage, footer, sponsors, calls } = harness();
    expect((await header(validHeader)).ok).toBe(true);
    expect((await hero(validHero)).ok).toBe(true);
    expect((await homepage(validHomepage)).ok).toBe(true);
    expect((await footer(validFooter)).ok).toBe(true);
    expect((await sponsors(validSponsors)).ok).toBe(true);
    const one = ["rateLimit:admin_edit", "handler", "invalidate:site-settings"];
    expect(calls).toEqual([...one, ...one, ...one, ...one, ...one]);
  });

  it.each([
    ["a visitor", null, "UNAUTHENTICATED"],
    ["a customer", customer, "FORBIDDEN"],
    ["a builder", builder, "FORBIDDEN"],
  ] as const)("refuses %s before anything runs, on every action", async (_who, session, code) => {
    const { header, hero, homepage, footer, sponsors, calls } = harness({ session });
    expect(await header(validHeader)).toMatchObject({ ok: false, code });
    expect(await hero(validHero)).toMatchObject({ ok: false, code });
    expect(await homepage(validHomepage)).toMatchObject({ ok: false, code });
    expect(await footer(validFooter)).toMatchObject({ ok: false, code });
    expect(await sponsors(validSponsors)).toMatchObject({ ok: false, code });
    expect(calls).toEqual([]);
  });

  it("refuses a value that is not valid before the handler, naming the box", async () => {
    const { hero, header, sponsors, calls } = harness();
    expect(await hero({ title: "", layout: "split" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { title: [{ key: "validation.required" }] },
    });
    expect(await header({ links: [{ label: "x", href: "javascript:alert(1)" }] })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { "links.0.href": [{ key: "validation.linkTarget" }] },
    });
    expect(
      await sponsors({
        sponsors: [{ id: "a", advertiser: "X", alt: "y", href: "http://x.example", active: true }],
      }),
    ).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { "sponsors.0.href": [{ key: "validation.linkInvalid" }] },
    });
    expect(calls).toEqual([]);
  });

  it("answers a rate limit with the wait, and does not run the handler", async () => {
    const { hero, calls } = harness({ rateLimited: true });
    expect(await hero(validHero)).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 600,
    });
    expect(calls).toEqual(["rateLimit:admin_edit"]);
  });
});
