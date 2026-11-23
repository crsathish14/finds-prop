import { describe, expect, it } from "vitest";
import { bodySchema } from "../../schemas";
import {
  BLOCKS_MAX,
  BLOG_ALT_MAX,
  HEADING_MAX,
  LIST_ITEMS_MAX,
  LIST_ITEM_MAX,
  PARAGRAPH_MAX,
} from "../../constants";
import { AI_PROMPT_EXAMPLE, buildAiPrompt } from "../ai-prompt";
import { convertMarkdown } from "../convert";

describe("buildAiPrompt: the prompt for any AI tool (ADR-173)", () => {
  const prompt = buildAiPrompt();

  it("states the limits the converter and the database hold", () => {
    expect(prompt).toContain(`at most ${HEADING_MAX} characters`);
    expect(prompt).toContain(`${PARAGRAPH_MAX.toLocaleString("en-US")} characters`);
    expect(prompt).toContain(`${LIST_ITEM_MAX} characters`);
    expect(prompt).toContain(`${LIST_ITEMS_MAX} items`);
    expect(prompt).toContain(`${BLOCKS_MAX} blocks`);
    expect(prompt).toContain(`${BLOG_ALT_MAX} characters`);
  });

  it("asks for the picture places, https links and one code block, and says to add nothing else", () => {
    expect(prompt).toContain("![what the picture shows](IMAGE-1)");
    expect(prompt).toContain("https://");
    expect(prompt).toContain("inside one code block");
    expect(prompt).toContain("Write nothing before or after it");
    expect(prompt.endsWith("below this line)\n\n")).toBe(true);
  });

  it("includes an example that converts with no change reported and makes a body the schema accepts", () => {
    expect(prompt).toContain(AI_PROMPT_EXAMPLE);
    const folder = "blog/00000000-0000-4000-8000-000000000001/";
    const result = convertMarkdown(AI_PROMPT_EXAMPLE, {
      "IMAGE-1": { path: `${folder}gate.jpg`, alt: "The front gate of the project" },
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.title).toBe("Five things to check before you buy a flat");
    expect(bodySchema.safeParse(result.blocks).success).toBe(true);
    expect(result.blocks.map((block) => block.type)).toEqual([
      "paragraph",
      "image",
      "heading",
      "list",
      "heading",
      "list",
      "quote",
      "paragraph",
    ]);
  });
});
