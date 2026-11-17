// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlaceSuggestions } from "../use-place-suggestions.client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function suggestion(id: string, label: string) {
  return {
    id,
    label,
    detail: "Chennai, Tamil Nadu, India",
    kind: "area",
    lat: 13.0012,
    lng: 80.2565,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** A fetch answer the test settles by hand, so the loading state can be looked at. */
function deferred() {
  let resolve: (response: Response) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<Response>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function setup(text = "") {
  return renderHook(({ typed }) => usePlaceSuggestions(typed), { initialProps: { typed: text } });
}

describe("usePlaceSuggestions (ADR-136)", () => {
  it("asks the route once and goes loading, then ready with the suggestions as options", async () => {
    const pending = deferred();
    fetchMock.mockReturnValueOnce(pending.promise);
    const view = setup();
    view.rerender({ typed: "adyar" });
    act(() => view.result.current.search("adyar"));

    expect(view.result.current.state).toBe("loading");
    expect(view.result.current.options).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [address, init] = fetchMock.mock.calls[0] ?? [];
    expect(address).toBe("/api/places/autocomplete?q=adyar&source=search_box");
    expect(init.signal).toBeInstanceOf(AbortSignal);

    pending.resolve(
      json({ ok: true, data: [suggestion("a", "Adyar"), suggestion("b", "Adyar Bridge")] }),
    );
    await waitFor(() => expect(view.result.current.state).toBe("ready"));
    expect(view.result.current.options).toEqual([
      { value: "a", label: "Adyar", description: "Chennai, Tamil Nadu, India" },
      { value: "b", label: "Adyar Bridge", description: "Chennai, Tamil Nadu, India" },
    ]);
  });

  it("trims the text it sends and encodes it", async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true, data: [] }));
    const view = setup();
    act(() => view.result.current.search("  K K Nagar & co "));
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/places/autocomplete?q=K+K+Nagar+%26+co&source=search_box",
    );
  });

  it("is empty when the route found no place", async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true, data: [] }));
    const view = setup("zzzz");
    act(() => view.result.current.search("zzzz"));
    await waitFor(() => expect(view.result.current.state).toBe("empty"));
    expect(view.result.current.options).toEqual([]);
  });

  it("is unavailable when the network fails", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const view = setup("adyar");
    act(() => view.result.current.search("adyar"));
    await waitFor(() => expect(view.result.current.state).toBe("unavailable"));
    expect(view.result.current.options).toEqual([]);
  });

  it("is unavailable when the answer is not JSON, or not in the shape of the route", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>bad gateway</html>", { status: 502 }));
    const view = setup("adyar");
    act(() => view.result.current.search("adyar"));
    await waitFor(() => expect(view.result.current.state).toBe("unavailable"));

    fetchMock.mockResolvedValueOnce(json({ ok: true, data: "nope" }));
    view.rerender({ typed: "adyars" });
    act(() => view.result.current.search("adyars"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(view.result.current.state).toBe("unavailable"));

    fetchMock.mockResolvedValueOnce(json(["a list"]));
    view.rerender({ typed: "adyarsx" });
    act(() => view.result.current.search("adyarsx"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(view.result.current.state).toBe("unavailable"));
  });

  it("is unavailable for a failure that says so and for one that says nothing", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ ok: false, code: "UPSTREAM_FAILED", reason: "unavailable", requestId: "r1" }, 502),
    );
    const view = setup("adyar");
    act(() => view.result.current.search("adyar"));
    await waitFor(() => expect(view.result.current.state).toBe("unavailable"));

    fetchMock.mockResolvedValueOnce(json({ ok: false, code: "INTERNAL", requestId: "r2" }, 500));
    view.rerender({ typed: "adyar2" });
    act(() => view.result.current.search("adyar2"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(view.result.current.state).toBe("unavailable"));
  });

  it("is limited when the route says the limit was reached, ours or the provider's", async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        { ok: false, code: "RATE_LIMITED", reason: "limited", retryAfter: 4, requestId: "r1" },
        429,
      ),
    );
    const view = setup("adyar");
    act(() => view.result.current.search("adyar"));
    await waitFor(() => expect(view.result.current.state).toBe("limited"));

    fetchMock.mockResolvedValueOnce(
      json({ ok: false, code: "UPSTREAM_FAILED", reason: "limited", requestId: "r2" }, 503),
    );
    view.rerender({ typed: "adyar2" });
    act(() => view.result.current.search("adyar2"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(view.result.current.state).toBe("limited"));
  });

  it("has nothing to suggest for text the route refuses as invalid, and the keyword row stays", async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: false, code: "VALIDATION", requestId: "r1" }, 400));
    const view = setup("x".repeat(90));
    act(() => view.result.current.search("x".repeat(90)));
    await waitFor(() => expect(view.result.current.state).toBe("empty"));
  });

  it("leaves out rows that are not suggestions and shows a repeated id once", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        ok: true,
        data: [
          suggestion("a", "Adyar"),
          suggestion("a", "Adyar again"),
          { id: "b", label: "", detail: "", lat: 1, lng: 2 },
          { id: "c", label: "No point", detail: "", lat: "13", lng: 80 },
          null,
          suggestion("d", "Adyar Bridge"),
        ],
      }),
    );
    const view = setup("adyar");
    act(() => view.result.current.search("adyar"));
    await waitFor(() => expect(view.result.current.state).toBe("ready"));
    expect(view.result.current.options.map((option) => option.label)).toEqual([
      "Adyar",
      "Adyar Bridge",
    ]);
  });

  it("cancels the older request when a newer one is asked, and ignores its late answer", async () => {
    const first = deferred();
    const second = deferred();
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const view = setup("ady");
    act(() => view.result.current.search("ady"));
    const firstSignal = fetchMock.mock.calls[0]?.[1].signal as AbortSignal;
    expect(firstSignal.aborted).toBe(false);

    view.rerender({ typed: "adyar" });
    act(() => view.result.current.search("adyar"));
    expect(firstSignal.aborted).toBe(true);
    expect((fetchMock.mock.calls[1]?.[1].signal as AbortSignal).aborted).toBe(false);

    // The older answer arrives after it was cancelled: it must not replace the newer question.
    first.resolve(json({ ok: true, data: [suggestion("old", "Old answer")] }));
    second.resolve(json({ ok: true, data: [suggestion("new", "Adyar")] }));
    await waitFor(() => expect(view.result.current.state).toBe("ready"));
    expect(view.result.current.options.map((option) => option.label)).toEqual(["Adyar"]);
  });

  it("does not show the answer of other text: it is loading again as soon as the text changes", async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true, data: [suggestion("a", "Adyar")] }));
    const view = setup("adyar");
    act(() => view.result.current.search("adyar"));
    await waitFor(() => expect(view.result.current.state).toBe("ready"));

    view.rerender({ typed: "adyars" });
    expect(view.result.current.state).toBe("loading");
    expect(view.result.current.options).toEqual([]);
  });

  it("asks nothing under three characters, and cancels what was on its way", () => {
    const pending = deferred();
    fetchMock.mockReturnValueOnce(pending.promise);
    const view = setup("ady");
    act(() => view.result.current.search("ady"));
    const signal = fetchMock.mock.calls[0]?.[1].signal as AbortSignal;

    act(() => view.result.current.search("ad"));
    act(() => view.result.current.search("  a "));
    act(() => view.result.current.search(""));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(signal.aborted).toBe(true);

    view.rerender({ typed: "ad" });
    expect(view.result.current.state).toBe("ready");
    expect(view.result.current.options).toEqual([]);
  });

  it("counts characters, not code units, for the minimum", async () => {
    fetchMock.mockResolvedValue(json({ ok: true, data: [] }));
    const view = setup();
    // The route counts code points (ADR-133): two Tamil letters are two, a third sign makes three.
    act(() => view.result.current.search("அட"));
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => view.result.current.search("அடை"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the suggestion that was picked, with its point, and keeps it as `picked`", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ ok: true, data: [suggestion("a", "Adyar"), suggestion("b", "Adyar Bridge")] }),
    );
    const view = setup("adyar");
    act(() => view.result.current.search("adyar"));
    await waitFor(() => expect(view.result.current.state).toBe("ready"));

    let choice: ReturnType<typeof view.result.current.pick> = null;
    act(() => {
      choice = view.result.current.pick({ value: "b", label: "Adyar Bridge" });
    });
    expect(choice).toMatchObject({ id: "b", label: "Adyar Bridge", lat: 13.0012, lng: 80.2565 });
    expect(view.result.current.picked).toMatchObject({ id: "b" });

    // The keyword row, or an option the list never had, is no pick.
    act(() => {
      choice = view.result.current.pick({ value: "keyword", label: "Search" });
    });
    expect(choice).toBeNull();
    expect(view.result.current.picked).toMatchObject({ id: "b" });
  });

  it("asks nothing for text equal to the picked name, and keeps its list", async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true, data: [suggestion("a", "Adyar")] }));
    const view = setup("ady");
    act(() => view.result.current.search("ady"));
    await waitFor(() => expect(view.result.current.state).toBe("ready"));
    act(() => {
      view.result.current.pick({ value: "a", label: "Adyar" });
    });

    // The Combobox puts the picked name in the box and would ask for it after its pause.
    view.rerender({ typed: "Adyar" });
    act(() => view.result.current.search("Adyar"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(view.result.current.state).toBe("ready");
    expect(view.result.current.options.map((option) => option.label)).toEqual(["Adyar"]);
  });

  it("cancels the request when the box goes away", () => {
    fetchMock.mockReturnValueOnce(deferred().promise);
    const view = setup("adyar");
    act(() => view.result.current.search("adyar"));
    const signal = fetchMock.mock.calls[0]?.[1].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
  });
});

describe("usePlaceSuggestions with another source (ADR-140)", () => {
  it("names the admin picker in the route's source, and still asks nothing under three characters", async () => {
    fetchMock.mockResolvedValue(json({ ok: true, data: [suggestion("a", "Adyar")] }));
    const view = renderHook(({ typed }) => usePlaceSuggestions(typed, "admin_picker"), {
      initialProps: { typed: "adyar" },
    });
    act(() => view.result.current.search("ad"));
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => view.result.current.search("adyar"));
    await waitFor(() => expect(view.result.current.state).toBe("ready"));
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/places/autocomplete?q=adyar&source=admin_picker",
    );
  });
});

describe("usePlaceSuggestions for the listing form (ADR-141)", () => {
  const street = { ...suggestion("s", "Velachery Main Road"), kind: "street" };

  it("names the listing form in the route's source", async () => {
    fetchMock.mockResolvedValue(json({ ok: true, data: [suggestion("a", "Velachery")] }));
    const view = renderHook(({ typed }) => usePlaceSuggestions(typed, "listing_form"), {
      initialProps: { typed: "velachery" },
    });
    act(() => view.result.current.search("velachery"));
    await waitFor(() => expect(view.result.current.state).toBe("ready"));
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/places/autocomplete?q=velachery&source=listing_form",
    );
  });

  it("keeps only the kinds it is asked for, and a pick still gives the kind", async () => {
    fetchMock.mockResolvedValue(json({ ok: true, data: [street, suggestion("a", "Velachery")] }));
    const kinds = ["area"] as const;
    const view = renderHook(({ typed }) => usePlaceSuggestions(typed, "listing_form", kinds), {
      initialProps: { typed: "vel" },
    });
    act(() => view.result.current.search("vel"));
    await waitFor(() => expect(view.result.current.state).toBe("ready"));
    expect(view.result.current.options.map((option) => option.label)).toEqual(["Velachery"]);
    let picked: ReturnType<typeof view.result.current.pick> = null;
    act(() => {
      picked = view.result.current.pick({ value: "a", label: "Velachery" });
    });
    expect(picked).toMatchObject({ id: "a", kind: "area", lat: 13.0012, lng: 80.2565 });
  });

  it("says empty when no suggestion of the kind is left", async () => {
    fetchMock.mockResolvedValue(json({ ok: true, data: [street] }));
    const kinds = ["area"] as const;
    const view = renderHook(({ typed }) => usePlaceSuggestions(typed, "listing_form", kinds), {
      initialProps: { typed: "vel" },
    });
    act(() => view.result.current.search("vel"));
    await waitFor(() => expect(view.result.current.state).toBe("empty"));
    expect(view.result.current.options).toEqual([]);
  });

  it("takes a suggestion with no kind (an older answer) and leaves one with an unknown kind out", async () => {
    const { kind: removed, ...withoutKind } = suggestion("n", "Nameless");
    void removed;
    fetchMock.mockResolvedValue(
      json({ ok: true, data: [withoutKind, { ...suggestion("x", "Strange"), kind: "planet" }] }),
    );
    const view = setup("nam");
    act(() => view.result.current.search("nam"));
    await waitFor(() => expect(view.result.current.state).toBe("ready"));
    expect(view.result.current.options.map((option) => option.label)).toEqual(["Nameless"]);
  });
});
