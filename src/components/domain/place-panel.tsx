"use client";

/**
 * usePlacePanel and PlaceAttribution: the words around a place combobox (ADR-131, UX addendum ADD-07).
 * Purpose: one place for what the suggestion panel says in each of its states, so the search card, the
 *   results filter and the post form cannot drift apart. Owner: design system. They hold no state and
 *   fetch nothing: the host knows whether the lookup is idle, loading, answered, empty, unavailable or
 *   limited, and asks for the panel props of that state.
 * Props: usePlacePanel(state, query): state is "ready" (suggestions are listed or there is nothing to
 *   say), "loading", "empty" (the provider found nothing), "unavailable" (it could not answer) or
 *   "limited" (our own limit refused), and query is the text in the box. It returns props to spread on
 *   Combobox (labels, idleNotices, notices, fallbackOption, loadingRows, footer). PlaceAttribution has no
 *   props: it is the footer line "Powered by Ola Maps" with the OpenStreetMap licence link (the Ola
 *   terms require both to stay visible).
 * Responsive: the footer wraps onto two lines in a narrow panel.
 * Accessibility: the credit's link opens in a new tab and says so to a screen reader; notes are plain
 *   text announced politely by the combobox.
 * States: ready, loading, empty, unavailable, limited; idle and typing are the notes shown before three
 *   letters.
 * Dependencies: Combobox types, Icon, Link, next-intl. Tests: place-panel.test.tsx; Design Lab "Domain,
 *   Place suggestions" (ADR-131).
 * UX reference: UX addendum ADD-07 (place-suggest): idle, typing, loading, results, noresults, degraded,
 *   ratelimited.
 */
import { Clock, Info, MapPin, Search, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type {
  ComboboxLabels,
  ComboboxNotice,
  ComboboxOption,
} from "@/components/patterns/combobox";
import type { Translate } from "@/lib/format";

type PlacePanelState = "ready" | "loading" | "empty" | "unavailable" | "limited";

type PlacePanelProps = {
  labels: ComboboxLabels;
  idleNotices: ComboboxNotice[];
  notices: ComboboxNotice[];
  fallbackOption?: ComboboxOption;
  loadingRows: true;
  footer: ReactNode;
};

/** The fewest letters the lookup needs: the same three the Combobox waits for. */
const MIN_LETTERS = 3;

/** "Powered by Ola Maps" and the OpenStreetMap licence, the credit the Ola terms ask to stay visible. */
function PlaceAttribution() {
  const translate = useTranslations() as unknown as Translate;
  return (
    <>
      <span>{translate("domain.places.attribution.poweredBy")}</span>
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline underline-offset-2"
      >
        {translate("domain.places.attribution.licence")}
        <span className="sr-only">{translate("domain.places.attribution.opensInNewTab")}</span>
      </a>
    </>
  );
}

function usePlacePanel(state: PlacePanelState, query: string): PlacePanelProps {
  const translate = useTranslations() as unknown as Translate;
  const typed = query.trim();
  const keyword: ComboboxOption = {
    value: "keyword",
    label: translate("domain.places.keyword.title", { query: typed }),
    description: translate("domain.places.keyword.body"),
    icon: Search,
  };
  const tamilNaduOnly: ComboboxNotice = {
    icon: MapPin,
    title: translate("domain.places.region"),
  };
  return {
    labels: {
      clear: translate("domain.places.clear"),
      loading: translate("domain.places.loading"),
      noResults: translate("domain.places.noResults"),
      resultCount: (count) => translate("domain.places.resultCount", { count }),
    },
    idleNotices: [
      {
        icon: Search,
        title: translate("domain.places.idle.title", { count: MIN_LETTERS }),
        body: translate(
          typed === "" ? "domain.places.idle.bodyEmpty" : "domain.places.idle.bodyTyping",
        ),
      },
      tamilNaduOnly,
    ],
    notices:
      state === "empty"
        ? [
            {
              icon: Info,
              title: translate("domain.places.empty.title", { query: typed }),
              body: translate("domain.places.empty.body"),
            },
          ]
        : state === "unavailable"
          ? [
              {
                icon: TriangleAlert,
                title: translate("domain.places.unavailable.title"),
                body: translate("domain.places.unavailable.body"),
              },
            ]
          : state === "limited"
            ? [
                {
                  icon: Clock,
                  title: translate("domain.places.limited.title"),
                  body: translate("domain.places.limited.body"),
                },
              ]
            : [],
    ...(state === "empty" || state === "unavailable" ? { fallbackOption: keyword } : {}),
    loadingRows: true,
    footer: <PlaceAttribution />,
  };
}

export { PlaceAttribution, usePlacePanel };
export type { PlacePanelProps, PlacePanelState };
