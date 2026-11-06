import type { LegalDocument } from "../types";

/**
 * The Privacy Policy. PLACEHOLDER TEXT (DEC-25): the headings and the data table are the approved
 * layout's (ADD-12); every bracketed sentence is where the owner's text goes. Set `draft` to false when
 * the final text is in.
 */
export const PRIVACY: LegalDocument = {
  kind: "privacy",
  draft: true,
  updated: null,
  version: null,
  summary: "[A short plain-language summary goes here: what we ask for, why, and who sees it.]",
  sections: [
    {
      id: "who-we-are",
      heading: "Who we are",
      blocks: [
        {
          type: "paragraph",
          text: "[Company name, registered address, how to reach you.]",
        },
      ],
    },
    {
      id: "what-we-collect",
      heading: "What we collect",
      blocks: [
        { type: "paragraph", text: "[Introductory sentence.]" },
        {
          type: "table",
          caption: "What we collect, why, who sees it and how long we keep it",
          head: ["Data", "Why we ask", "Who sees it", "How long"],
          rows: [
            ["Mobile number", "[Purpose]", "[Recipients]", "[Period]"],
            ["Email address", "[Purpose]", "[Recipients]", "[Period]"],
            ["Enquiry details", "[Purpose]", "[Recipients]", "[Period]"],
            ["Listing details and photos", "[Purpose]", "[Recipients]", "[Period]"],
          ],
        },
      ],
    },
    {
      id: "how-we-use-it",
      heading: "How we use it",
      blocks: [{ type: "list", items: ["[Purpose one]", "[Purpose two]", "[Purpose three]"] }],
    },
    {
      id: "who-we-share-it-with",
      heading: "Who we share it with",
      blocks: [
        {
          type: "paragraph",
          text: "[Owners and builders you contact; service providers for text messages, email, maps and hosting.]",
        },
      ],
    },
    {
      id: "how-long-we-keep-it",
      heading: "How long we keep it",
      blocks: [{ type: "paragraph", text: "[Retention periods.]" }],
    },
    {
      id: "your-choices",
      heading: "Your choices",
      blocks: [
        {
          type: "paragraph",
          text: "[How to access, correct or delete your data, and how to withdraw consent.]",
        },
      ],
    },
    {
      id: "cookies",
      heading: "Cookies",
      blocks: [{ type: "paragraph", text: "[A pointer to the Cookie information page.]" }],
    },
    {
      id: "security",
      heading: "Security",
      blocks: [{ type: "paragraph", text: "[Short statement.]" }],
    },
    {
      id: "changes",
      heading: "Changes",
      blocks: [{ type: "paragraph", text: "[How you will be told.]" }],
    },
    {
      id: "contact-us",
      heading: "Contact us",
      blocks: [{ type: "paragraph", text: "[Email address and postal address.]" }],
    },
  ],
};
