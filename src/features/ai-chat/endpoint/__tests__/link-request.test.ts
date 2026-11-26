import { describe, expect, it } from "vitest";
import { askedForLink } from "../link-request";

describe("UT-ai-link-request: when the customer asked for a link (ADR-209)", () => {
  it.each([
    "Send me the link",
    "can you share the URL?",
    "Where is this from?",
    "Where did you get that?",
    "What is the source?",
    "Open the project page",
    "I want to read the full article",
    "read more",
    "Let me see all of them",
    "show all the results",
    "all 15 matches please",
    "is there a website for this?",
  ])("says yes to %j", (message) => {
    expect(askedForLink(message)).toBe(true);
  });

  it.each([
    "2 BHK homes in Velachery",
    "Show me all homes in Adyar",
    "How are stamp duty and registration charges worked out?",
    "Show more",
    "Compare these two projects",
    "Prime projects in OMR under 2 crore",
    "",
  ])("says no to %j", (message) => {
    expect(askedForLink(message)).toBe(false);
  });
});
