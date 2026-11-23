# ADR-178 · AI search: a city given as a locality

- Status: Accepted (a fix for a defect the owner reported on 24 Nov 2026; no new customer wording).
- Date: 2026-11-24
- Related: ADR-128 section 5.1 (`search_properties`)
- Class: C1. No migration, no dependency, no data change.

## Context

The owner searched for homes to buy in Chennai in the AI search and was told there were none, although the dev database holds 14 approved homes for sale in Chennai. Searching for Velachery found homes. The search of the website has a `locality` filter (a neighbourhood) and a `keyword` filter (words in the title, the locality or the city). No home has a locality called Chennai: the city is a separate field. The assistant put "Chennai" into `locality`, so the search found nothing.

Checked against the dev database with the guest search function: `locality = Chennai` found 0 homes, `keyword = Chennai` found 10 (the most one call gives), and the city filter found 10.

## Decision

- **A second try, in code.** When a search with a locality and no keyword finds nothing, `search_properties` runs the same search once more with the same words as the keyword and no locality, and answers with that if it is better. It is the same cached public search (or the guest's narrow read), so no new access is opened. A search that found homes, had no locality, or already had a keyword is not repeated; if the second read fails the first answer stands. A locality that really has no homes still ends in an honest "none".
- **The tool description says it too:** a city such as Chennai or Coimbatore is not a locality; put it in `keyword`. The code fallback is there because the model does not always follow that.

## Alternatives not taken

- **Mock data.** Not a data problem: the homes exist.
- **A list of city names in code** to move a city out of `locality`: needs a read of the listed cities on every search, and would miss a city added later. The retry is general and costs one extra read only when the first found nothing.
- **A `city` filter on the assistant's search:** the database function has one for guests, but the shared search page does not, so it would be a new filter on the page's own search for the sake of one word.

## Consequences

- "Homes in Chennai" now finds Chennai homes. The same retry also helps a locality spelled in a way the filter does not match, when the words appear in a title.
- A search that finds nothing costs one extra cached read.
