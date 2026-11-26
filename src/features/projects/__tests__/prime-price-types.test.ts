import { describe, expect, it } from "vitest";
import { PRIME_RULE_OF_PRICE_TYPE } from "@/lib/project-prime";
import { PRICE_TYPES } from "../schemas";

describe("UT-project-prime-types: every project price type has a Prime amount (ADR-208)", () => {
  it("lists the same price types as the project's own", () => {
    expect(Object.keys(PRIME_RULE_OF_PRICE_TYPE).sort()).toEqual([...PRICE_TYPES].sort());
  });
});
