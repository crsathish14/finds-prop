# ADR-197 · A guest who asks for homes near a place gets an area-name search, not a refusal

- Status: Accepted. Plan approved by the owner on 26 Nov 2026 (option B). Amends ADR-171 for one case; nothing else in the login wall changes.
- Date: 2026-11-26
- Related: ADR-171 (login wall), ADR-142 (AI place search), ADR-178 (locality retried as a keyword)
- Class: C2 (changes who may reach a search and the assistant's behaviour). No migration, no dependency, no new visitor words.

## Context

ADR-171 made the place lookup of `search_properties` a signed-in feature, because the lookup reads the localities of homes and projects. The assistant is told to put "near X" in `place`, so a guest who wrote "2bhk near Adyar" was refused with `sign_in_required` and spent one of the two free messages on a sign-in request, while "adyar 2bhk rent" (an area name in `locality`) worked. The two phrasings meant the same to the guest and behaved differently.

## Decision

- A guest's `place` is no longer refused. The map lookup is **not** called for a guest. The place words are used as the `locality` (unless the model gave a locality), with every other filter kept, and the search goes through the same narrow guest read as before (`getSearchResults(..., { guest: true })`), with the existing second try as a keyword (ADR-178). The distance (`radiusKm`) is ignored.
- The result carries a new place status `guest_area` and a fixed note for the model: say once that these are homes matching the area's name and not measured by distance, say that signing in allows a search within a distance, add `[[link:sign_in]]` once, and say plainly when nothing matched. The status is for the model only and is not shown.
- Signed-in customers are unchanged: the lookup and the distance search work as in ADR-142.
- The `sign_in_required` hint no longer lists "searching around a place" among the refused things. Projects, builders and localities are still refused for a guest.

## Consequences

- No map quota is spent for a guest, and no project locality reaches a guest: the only data source is the guest read.
- A landmark or station ("near Guindy station") will often match no home by name, so the guest gets no homes and the sign-in prompt. This is accepted: it is honest, and a distance search stays a signed-in feature.
- The wording of the reply is the model's, steered by the note, so it can vary.
- Only matters while `FLAG_AI_PLACE_SEARCH` is on; with it off the tool has no `place` and the model already uses the locality.

## Tests

`UT-ai-tool-sign-in` (`sign-in-required.test.ts`): a guest's place gives the `guest_area` status, calls no lookup, reads with `guest: true`, uses the place words as the locality, sends no coordinates; no match retries as a keyword and keeps the note; a signed-in customer still reaches the lookup.
