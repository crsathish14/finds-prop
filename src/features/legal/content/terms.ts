import type { LegalDocument } from "../types";

/**
 * The Terms of Use. PLACEHOLDER TEXT (DEC-25): the headings are the approved layout's (ADD-12); every
 * bracketed sentence is where the owner's text goes. Set `draft` to false when the final text is in.
 */
export const TERMS: LegalDocument = {
  kind: "terms",
  draft: true,
  updated: null,
  version: null,
  summary: "[A short plain-language summary goes here.]",
  sections: [
    {
      id: "using-find-prop",
      heading: "Using Find Prop",
      blocks: [{ type: "paragraph", text: "[Text.]" }],
    },
    {
      id: "your-account",
      heading: "Your account",
      blocks: [{ type: "paragraph", text: "[Text.]" }],
    },
    {
      id: "listings-and-content",
      heading: "Listings and content",
      blocks: [
        {
          type: "paragraph",
          text: "[Text: accuracy, rights to advertise, review before publication.]",
        },
      ],
    },
    {
      id: "enquiries",
      heading: "Enquiries",
      blocks: [{ type: "paragraph", text: "[Text.]" }],
    },
    {
      id: "builders-and-sponsors",
      heading: "Builders and sponsors",
      blocks: [
        {
          type: "paragraph",
          text: "[Text: sponsored content, who is responsible for what is inside a banner.]",
        },
      ],
    },
    {
      id: "what-you-must-not-do",
      heading: "What you must not do",
      blocks: [{ type: "list", items: ["[Rule one]", "[Rule two]"] }],
    },
    {
      id: "our-responsibility",
      heading: "Our responsibility",
      blocks: [{ type: "paragraph", text: "[Text.]" }],
    },
    {
      id: "changes",
      heading: "Changes",
      blocks: [{ type: "paragraph", text: "[Text.]" }],
    },
    {
      id: "governing-law",
      heading: "Governing law",
      blocks: [{ type: "paragraph", text: "[Text.]" }],
    },
    {
      id: "contact-us",
      heading: "Contact us",
      blocks: [{ type: "paragraph", text: "[Text.]" }],
    },
  ],
};
