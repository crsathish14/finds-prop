import type { LegalDocument } from "../types";

/**
 * The Cookie information. PLACEHOLDER TEXT (DEC-25) around a table of what the site really stores in the
 * browser today, taken from the code (6 Nov 2026) for the owner to check: the sign-in session, the human
 * check on sign-in, the compare list, a home waiting to be saved, and the choice "Later" on the email
 * prompt. There is no analytics and no optional cookie, so there is no cookie banner. Set `draft` to
 * false when the final text is in.
 */
export const COOKIES: LegalDocument = {
  kind: "cookies",
  draft: true,
  updated: null,
  version: null,
  summary: "[What we store in your browser and why.]",
  sections: [
    {
      id: "what-cookies-are",
      heading: "What cookies are",
      blocks: [{ type: "paragraph", text: "[Short explanation.]" }],
    },
    {
      id: "what-we-use",
      heading: "What we use",
      blocks: [
        {
          type: "table",
          caption: "What the site stores in your browser, why, what kind and for how long",
          head: ["Name or purpose", "Why", "Kind", "How long"],
          rows: [
            ["Sign-in session", "Keeps you signed in", "Essential", "[Period]"],
            [
              "Human check on sign-in",
              "Tells a person from a program when you ask for a code",
              "Essential",
              "[Period]",
            ],
            [
              "Compare list (browser storage)",
              "Remembers homes you chose to compare",
              "Essential",
              "Until you clear it",
            ],
            [
              "Home waiting to be saved (browser storage)",
              "Saves the home you chose once you have signed in",
              "Essential",
              "Until you close the tab",
            ],
            [
              "Email prompt choice (browser storage)",
              "Remembers that you chose Later on the email prompt",
              "Preference",
              "Until you clear it",
            ],
          ],
        },
      ],
    },
    {
      id: "your-choices",
      heading: "Your choices",
      blocks: [{ type: "paragraph", text: "[How to change settings.]" }],
    },
    {
      id: "contact-us",
      heading: "Contact us",
      blocks: [{ type: "paragraph", text: "[Text.]" }],
    },
  ],
};
