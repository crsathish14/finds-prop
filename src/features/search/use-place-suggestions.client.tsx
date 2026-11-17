"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlacePanelState } from "@/components/domain/place-panel";
import type { ComboboxOption } from "@/components/patterns/combobox";
import type { PlaceAutocompleteSuggestion } from "@/types/places";

/**
 * The place suggestions of the search box (ADR-136): the browser side of `GET /api/places/autocomplete`
 * (ADR-133). The Combobox already waits for three characters and a 300 ms pause before it calls
 * `search`, so the hook only has to ask, cancel an older question when a newer one comes, and say in
 * which state the panel is. It never blocks: a failure of any kind is a state of the panel
 * (`unavailable`, `limited`, `empty`), and the box keeps working as a plain text field (FR-GEO-01,
 * criterion 3). Nothing is stored; the text typed is sent to the route and nowhere else.
 */

/** The fewest letters a lookup needs: the route's own minimum, and the Combobox's. */
export const PLACE_MIN_CHARACTERS = 3;

const ENDPOINT = "/api/places/autocomplete";
/** Names the box in the usage count (ADR-134); the route ignores a value it does not know. */
const SOURCE = "search_box";

/** What a picked suggestion gives the search: its name and its point. */
export type PlaceChoice = Pick<
  PlaceAutocompleteSuggestion,
  "id" | "label" | "detail" | "lat" | "lng"
>;

type Settled = "ready" | "empty" | "unavailable" | "limited";
type Answer = { query: string; status: Settled | "loading"; suggestions: PlaceChoice[] };

const UNAVAILABLE: Pick<Answer, "status" | "suggestions"> = {
  status: "unavailable",
  suggestions: [],
};

function isChoice(value: unknown): value is PlaceChoice {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row["id"] === "string" &&
    row["id"] !== "" &&
    typeof row["label"] === "string" &&
    row["label"] !== "" &&
    typeof row["detail"] === "string" &&
    typeof row["lat"] === "number" &&
    Number.isFinite(row["lat"]) &&
    typeof row["lng"] === "number" &&
    Number.isFinite(row["lng"])
  );
}

/** Reads the route's answer (the `ActionResult` envelope of ADR-133). Anything unexpected is `unavailable`. */
async function readAnswer(response: Response): Promise<Pick<Answer, "status" | "suggestions">> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return UNAVAILABLE;
  }
  if (typeof body !== "object" || body === null) return UNAVAILABLE;
  const envelope = body as Record<string, unknown>;
  if (envelope["ok"] === true) {
    const data = envelope["data"];
    if (!Array.isArray(data)) return UNAVAILABLE;
    // The provider's id is the list key, so a repeated one is shown once.
    const seen = new Set<string>();
    const suggestions = data.filter(isChoice).filter((choice) => {
      if (seen.has(choice.id)) return false;
      seen.add(choice.id);
      return true;
    });
    return { status: suggestions.length === 0 ? "empty" : "ready", suggestions };
  }
  if (envelope["ok"] !== false) return UNAVAILABLE;
  if (envelope["reason"] === "limited") return { status: "limited", suggestions: [] };
  // Text the route will not take (too long): nothing to suggest, and the keyword row still searches it.
  if (envelope["code"] === "VALIDATION") return { status: "empty", suggestions: [] };
  return UNAVAILABLE;
}

function countCharacters(text: string): number {
  return [...text].length;
}

/**
 * `text` is what is in the box now. Returns the options and the panel state for it, `search` (give it to
 * the Combobox's `onQueryChange`), and `pick` (call it from `onSelect`: it returns the suggestion that
 * option stands for, and remembers it as `picked`).
 *
 * The panel is `loading` from the moment there are three characters until the answer for exactly that
 * text arrives, and the old suggestions are not shown meanwhile, so a pick can never be a suggestion for
 * text that is no longer in the box. A text equal to the picked name asks nothing (it was answered).
 */
export function usePlaceSuggestions(text: string): {
  options: ComboboxOption[];
  state: PlacePanelState;
  search: (query: string) => void;
  pick: (option: ComboboxOption) => PlaceChoice | null;
  picked: PlaceChoice | null;
} {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [picked, setPicked] = useState<PlaceChoice | null>(null);
  const pickedNow = useRef<PlaceChoice | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );

  const search = useCallback((query: string) => {
    const typed = query.trim();
    // A newer question always cancels the older one, even when it asks nothing itself.
    request.current?.abort();
    request.current = null;
    if (countCharacters(typed) < PLACE_MIN_CHARACTERS) return;
    if (pickedNow.current?.label === typed) return;

    const controller = new AbortController();
    request.current = controller;
    setAnswer({ query: typed, status: "loading", suggestions: [] });
    void (async () => {
      let settled: Pick<Answer, "status" | "suggestions">;
      try {
        const response = await fetch(
          `${ENDPOINT}?${new URLSearchParams({ ["q"]: typed, source: SOURCE })}`,
          {
            signal: controller.signal,
            headers: { accept: "application/json" },
          },
        );
        settled = await readAnswer(response);
      } catch {
        settled = UNAVAILABLE;
      }
      if (controller.signal.aborted) return;
      setAnswer({ query: typed, ...settled });
    })();
  }, []);

  const pick = useCallback(
    (option: ComboboxOption): PlaceChoice | null => {
      const choice =
        answer?.suggestions.find((suggestion) => suggestion.id === option.value) ?? null;
      if (choice === null) return null;
      pickedNow.current = choice;
      setPicked(choice);
      return choice;
    },
    [answer],
  );

  const typed = text.trim();
  const enough = countCharacters(typed) >= PLACE_MIN_CHARACTERS;
  // The answer is for this text, or for the text the picked name came from (its list is still the list).
  const answersThis = answer !== null && (answer.query === typed || picked?.label === typed);

  let state: PlacePanelState = "ready";
  if (enough) {
    if (!answersThis) state = "loading";
    else if (answer.status === "loading") state = "loading";
    else if (answer.status === "ready") state = "ready";
    else state = answer.status;
  }

  const options: ComboboxOption[] =
    enough && answersThis && answer.status === "ready"
      ? answer.suggestions.map((suggestion) => ({
          value: suggestion.id,
          label: suggestion.label,
          description: suggestion.detail,
        }))
      : [];

  return { options, state, search, pick, picked };
}
