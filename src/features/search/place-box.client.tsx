"use client";

import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type KeyboardEvent } from "react";
import { usePlacePanel } from "@/components/domain/place-panel";
import type { PlaceFieldContext } from "@/components/domain/filters";
import { Combobox } from "@/components/patterns/combobox";
import type { Translate } from "@/lib/format";
import { PLACE_MIN_CHARACTERS, usePlaceSuggestions } from "./use-place-suggestions.client";

/** The value of the combobox's keyword row (usePlacePanel makes it): choosing it searches the typed text. */
const KEYWORD_ROW = "keyword";

/** More letters than any name has: a box whose text is the place already chosen opens no panel. */
const NEVER = 1000;

type PlaceBoxProps = PlaceFieldContext & {
  /**
   * True where the choices are only a draft until a button applies them (the phone's filter sheet): the
   * typed text is then part of the draft at once. False on the rail, where every change reloads the
   * results, so the text counts only when it is picked, searched (Enter or the keyword row) or cleared.
   */
  applyWhileTyping?: boolean;
};

/**
 * The Locality field of the results filters (the rail and the phone sheet) as a place search box
 * (ADR-136): the suggestions and panel of the place search. Picking a suggestion sets the
 * locality to its name and its point; the keyword row, or Enter on typed text, sets the text alone (a
 * text match); an empty box takes the place off. If suggestions are unavailable the box is a text field
 * and Enter searches what is typed. It holds only the text in the box; the choice goes up through
 * `onChange`, and the page decides what the address becomes.
 */
export function PlaceBox({ id, values, onChange, applyWhileTyping = false }: PlaceBoxProps) {
  const translate = useTranslations() as unknown as Translate;
  const current = values.locality ?? "";
  const [text, setText] = useState(current);
  const [seen, setSeen] = useState(current);
  // False while the text is the one the page gave (the chosen place, at the start or after a change from
  // elsewhere): there is nothing to suggest until the visitor edits it.
  const [edited, setEdited] = useState(false);
  // The place changed from elsewhere (a chip removed, Clear all): show it. Adjusting state while
  // rendering, as React documents, avoids a frame with the old text. A change that is the box's own
  // (a pick, or typing in the sheet's draft) already is the text.
  if (current !== seen) {
    setSeen(current);
    if (current !== text.trim()) {
      setText(current);
      setEdited(false);
    }
  }
  const places = usePlaceSuggestions(text);
  const panel = usePlacePanel(places.state, text);
  // An Enter that chose a row must not also search the typed text (the same guard as every place box).
  const justPicked = useRef(false);
  const unchanged = !edited && text.trim() !== "";

  function applyText(next: string) {
    const trimmed = next.trim();
    if (trimmed === current) return;
    onChange({ ...values, locality: trimmed === "" ? null : trimmed, point: null });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter") return;
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    event.preventDefault();
    applyText(text);
  }

  return (
    <div onKeyDown={onKeyDown}>
      <Combobox
        id={id}
        aria-label={translate("domain.searchCard.locality.label")}
        placeholder={translate("domain.searchCard.locality.placeholder")}
        icon={MapPin}
        value={text}
        onValueChange={(next) => {
          setText(next);
          setEdited(true);
          if (applyWhileTyping || next.trim() === "") applyText(next);
        }}
        onQueryChange={places.search}
        onSelect={(option) => {
          justPicked.current = true;
          queueMicrotask(() => {
            justPicked.current = false;
          });
          if (option.value === KEYWORD_ROW) {
            applyText(text);
            return;
          }
          const choice = places.pick(option);
          if (choice === null) return;
          onChange({
            ...values,
            locality: choice.label,
            point: { lat: choice.lat, lng: choice.lng },
          });
        }}
        options={places.options}
        loading={places.state === "loading"}
        minChars={unchanged ? NEVER : PLACE_MIN_CHARACTERS}
        {...panel}
        idleNotices={unchanged ? [] : panel.idleNotices}
      />
    </div>
  );
}
