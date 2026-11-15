import { describe, expect, it } from "vitest";
import messages from "@/i18n/messages/en.json";
import { detectLanguage, readLanguage } from "../language";

// UT-ai-eval-language (AI-P8-T01): how the eval reads the language of an answer. The Tamil and Tanglish samples are
// the customer examples already in en.json (`ai.examples`): this folder writes no assistant Tamil (decision D12).

describe("UT-ai-eval-language", () => {
  it("reads English", () => {
    expect(
      detectLanguage("I found one 3 BHK home in Velachery for ₹1.25 Cr. Shall we look at more?"),
    ).toBe("en");
  });

  it("reads Tamil script, even with Latin names and numbers in it", () => {
    expect(detectLanguage(messages.ai.examples.tamil)).toBe("ta");
    expect(readLanguage(messages.ai.examples.tamil).tamilShare).toBeGreaterThan(0.3);
  });

  it("reads Tanglish: Tamil written in English letters", () => {
    expect(detectLanguage(messages.ai.examples.tanglish)).toBe("tanglish");
    expect(detectLanguage("Velachery la oru 3 BHK irukku, ungalukku venum na sollunga")).toBe(
      "tanglish",
    );
  });

  it("does not take one Tanglish word in a long English answer for Tanglish", () => {
    expect(
      detectLanguage(
        "Kadal Vista is an under-construction project in OMR Navalur by Kadal Homes, with prices from ₹78 L to ₹1.42 Cr. Please tell me if you want more details, sari?",
      ),
    ).toBe("en");
  });

  it("ignores numbers, links and card markers", () => {
    expect(detectLanguage("[[home:k3x9a2bd]] ₹1,25,00,000 https://kadalhomes.example.test/")).toBe(
      "unknown",
    );
  });

  it("says unknown for nothing to read", () => {
    expect(detectLanguage("")).toBe("unknown");
    expect(detectLanguage("12 34")).toBe("unknown");
  });
});
