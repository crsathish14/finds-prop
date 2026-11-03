// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/types/action";
import { signOut } from "../actions";
import { goTo } from "../navigate";
import { useSignOut } from "../use-sign-out.client";

// The action reaches the server and goTo leaves the page; the tests stand in for both.
vi.mock("../actions", () => ({ signOut: vi.fn() }));
vi.mock("../navigate", () => ({ goTo: vi.fn() }));

const ask = vi.mocked(signOut);
const go = vi.mocked(goTo);

function answer(result: ActionResult<{ signedOut: true }>) {
  ask.mockResolvedValueOnce(result);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useSignOut: what the avatar menu's Sign out entry calls", () => {
  it("asks the server to sign out, then goes to the home page with a full load", async () => {
    answer({ ok: true, data: { signedOut: true } });
    const { result } = renderHook(() => useSignOut());
    act(() => result.current.signOut());
    await waitFor(() => expect(go).toHaveBeenCalledWith("/"));
    expect(ask).toHaveBeenCalledWith({});
    expect(result.current.failed).toBe(false);
  });

  it("goes to the page it was given, so staff land on their own sign-in", async () => {
    answer({ ok: true, data: { signedOut: true } });
    const { result } = renderHook(() => useSignOut("/builder/login"));
    act(() => result.current.signOut());
    await waitFor(() => expect(go).toHaveBeenCalledWith("/builder/login"));
  });

  it("stays put and says it failed when the session could not be ended", async () => {
    answer({ ok: false, code: "UPSTREAM_FAILED" });
    const { result } = renderHook(() => useSignOut());
    act(() => result.current.signOut());
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(go).not.toHaveBeenCalled();
  });

  it("clears the failure on the next try, and goes on when that works", async () => {
    answer({ ok: false, code: "INTERNAL" });
    const { result } = renderHook(() => useSignOut());
    act(() => result.current.signOut());
    await waitFor(() => expect(result.current.failed).toBe(true));
    answer({ ok: true, data: { signedOut: true } });
    act(() => result.current.signOut());
    await waitFor(() => expect(go).toHaveBeenCalledWith("/"));
    expect(result.current.failed).toBe(false);
  });

  it("is pending while it waits, and a second press does not ask again", async () => {
    let finish: (value: ActionResult<{ signedOut: true }>) => void = () => undefined;
    ask.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const { result } = renderHook(() => useSignOut());
    act(() => result.current.signOut());
    await waitFor(() => expect(result.current.pending).toBe(true));
    act(() => result.current.signOut());
    expect(ask).toHaveBeenCalledOnce();
    await act(async () => finish({ ok: true, data: { signedOut: true } }));
    await waitFor(() => expect(go).toHaveBeenCalledOnce());
  });
});
