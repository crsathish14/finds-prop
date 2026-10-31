# Playbook: add a language (class C1, with a native-speaker review)

Read `AGENTS.md`, `docs/adr/035-text-in-en-json.md` and `docs/engineering/frontend.md` (R-FE-21 to R-FE-23) first. Example: Tamil (`ta`).

Before you start: a language switcher and any Tamil screens are not in the approved UX. Ask the owner for the UX addendum item first (R-FE-20).

1. **Copy the file.** `src/i18n/messages/en.json` to `src/i18n/messages/ta.json`. Keep every key and every `{variable}` exactly; translate only the words. Plural blocks use the language's own plural categories.
2. **Translate with a native reader.** Machine output is a first draft only. Do not translate brand or product names that the owner keeps in English.
3. **Run the parity check.** `npm run policy` (`check-messages`) fails on a missing key, an extra key or a changed variable.
4. **Enable the language.** Add `"ta"` to `locales` in `src/i18n/routing.ts` and a `ta: "ta-IN"` entry to `INTL_LOCALES` in `src/lib/format.ts`. English keeps no prefix; Tamil is served at `/ta/...`. Update the typed `Locale` if the build asks for it.
5. **Check the pieces that are not messages.**
   - Fonts: Noto Sans Tamil is in the font stack; confirm weights and the subset.
   - Words around numbers: `format.*` messages (₹, lakh, crore, sq.ft) read naturally in the language.
   - `global-error` and `global-not-found` read `en.json` directly; add the language there or choose the text by the URL.
   - SMS and email templates: each language needs its own approved template ids (DLT for SMS). Not covered by `en.json` (DEC-41).
   - `hreflang` links and the sitemap list every language; set `<html lang>` (done by the layout).
   - Admin-edited site copy (`site_settings`) needs per-language values (DEC-41).
6. **Test.** `npm run check`, `npm run build`, `npm run test:e2e:smoke`; open the main screens in the new language at 390, 820 and 1440 widths and look for text that wraps badly or is cut off. Tamil words are often longer than English.
7. **Switch on behind a setting** until the owner and the reviewer sign off, then record it in the PR.
