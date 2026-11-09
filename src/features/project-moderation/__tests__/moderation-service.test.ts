import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import type { Database } from "@/types/database.types";

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/server", () => ({ createServerSupabase: vi.fn() }));

const { applyDecision, mapModerationError, removeProject } = await import("../moderation-service");
const { projectModerationStore } = await import("../service");

const PROJECT = "00000000-0000-4000-c000-000000000001";

describe("UT-project-moderation-service: the database's answers as action errors (S7-T04)", () => {
  it.each([
    [{ message: "project.not_found" }, "NOT_FOUND"],
    [{ code: "P0002" }, "NOT_FOUND"],
    [{ message: "project.not_reviewable" }, "CONFLICT"],
    [{ message: "project.not_publishable" }, "CONFLICT"],
    [{ message: "project.not_featurable" }, "CONFLICT"],
    [{ code: "55000" }, "CONFLICT"],
    [{ code: "23503" }, "CONFLICT"],
    [{ message: "project.not_allowed" }, "FORBIDDEN"],
    [{ code: "42501" }, "FORBIDDEN"],
    [{ message: "project.bad_action" }, "VALIDATION"],
    [{ code: "22023" }, "VALIDATION"],
    [{ code: "XX000", message: "boom" }, "INTERNAL"],
    [{}, "INTERNAL"],
  ])("maps %j to %s", (failure, code) => {
    expect(mapModerationError(failure)).toMatchObject({ code });
  });

  it("says a delete was refused for leads in words the page can use, and never repeats the database's text", () => {
    const refused = mapModerationError({ code: "23503", message: "violates foreign key" });
    expect(refused.message).toBe("The project has leads, so it cannot be deleted");
    expect(mapModerationError({ code: "XX000", message: "secret detail" }).message).not.toContain(
      "secret",
    );
  });

  it("passes the project and the decision to the store, and the store's answer back", async () => {
    const decide = vi.fn(async () => ({
      projectId: PROJECT,
      slug: "kadal-vista",
      moderation: "approved",
      published: false,
      featured: false,
    }));
    const done = await applyDecision(
      { decide, remove: vi.fn() },
      { projectId: PROJECT, decision: "approve" },
    );
    expect(decide).toHaveBeenCalledWith(PROJECT, "approve");
    expect(done.moderation).toBe("approved");
  });

  it("passes a delete to the store", async () => {
    const remove = vi.fn(async () => ({ projectId: PROJECT, slug: "kadal-vista" }));
    await removeProject({ decide: vi.fn(), remove }, { projectId: PROJECT });
    expect(remove).toHaveBeenCalledWith(PROJECT);
  });
});

describe("UT-project-moderation-store: the calls made as the admin (S7-T04)", () => {
  const decided = {
    id: PROJECT,
    slug: "kadal-vista",
    moderation: "approved",
    published: true,
    featured: false,
  };

  it("calls moderate_project and gives back the project as it is now", async () => {
    const rpc = vi.fn(async () => ({ data: [decided], error: null }));
    const store = projectModerationStore({ rpc } as unknown as SupabaseClient<Database>);
    expect(await store.decide(PROJECT, "publish")).toEqual({
      projectId: PROJECT,
      slug: "kadal-vista",
      moderation: "approved",
      published: true,
      featured: false,
    });
    expect(rpc).toHaveBeenCalledWith("moderate_project", {
      p_project: PROJECT,
      p_action: "publish",
    });
  });

  it("throws the database's refusal as an action error", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "55000", message: "x" } }));
    const store = projectModerationStore({ rpc } as unknown as SupabaseClient<Database>);
    const failure = await store.decide(PROJECT, "approve").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ActionError);
    expect(failure).toMatchObject({ code: "CONFLICT" });
  });

  /** A stand-in for `from("projects").delete().eq().select()`. */
  function deleting(answer: { data: unknown; error: { code?: string } | null }) {
    const select = vi.fn(async () => answer);
    const eq = vi.fn(() => ({ select }));
    const remove = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ delete: remove }));
    return {
      client: { from } as unknown as SupabaseClient<Database>,
      eq,
      select,
    };
  }

  it("deletes the one project and gives back its address, for the tags", async () => {
    const { client, eq, select } = deleting({
      data: [{ id: PROJECT, slug: "kadal-vista" }],
      error: null,
    });
    expect(await projectModerationStore(client).remove(PROJECT)).toEqual({
      projectId: PROJECT,
      slug: "kadal-vista",
    });
    expect(eq).toHaveBeenCalledWith("id", PROJECT);
    expect(select).toHaveBeenCalledWith("id, slug");
  });

  it("says not found when nothing was deleted, and conflict when the project has leads", async () => {
    const nothing = deleting({ data: [], error: null });
    await expect(projectModerationStore(nothing.client).remove(PROJECT)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const leads = deleting({ data: null, error: { code: "23503" } });
    await expect(projectModerationStore(leads.client).remove(PROJECT)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
