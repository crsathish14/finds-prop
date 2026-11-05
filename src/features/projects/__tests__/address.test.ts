import { describe, expect, it } from "vitest";
import { canonicalProjectPath, isProjectSlug, parseProjectSlug, projectPath } from "../address";

describe("UT-project-address: the address of a project page", () => {
  it("builds the path from the slug", () => {
    expect(projectPath("kadal-vista")).toBe("/projects/kadal-vista");
  });

  it("accepts the slugs the database allows", () => {
    for (const slug of ["ab", "kadal-vista", "tower-2-omr", "a1", "x".repeat(80)]) {
      expect(isProjectSlug(slug)).toBe(true);
    }
  });

  it("refuses text the database could not hold as a slug", () => {
    for (const text of [
      "",
      "a",
      "x".repeat(81),
      "-kadal",
      "kadal-",
      "kadal--vista",
      "kadal vista",
      "kadal_vista",
      "kadal/vista",
      "kadal.vista",
      "Kadal",
    ]) {
      expect(isProjectSlug(text)).toBe(false);
    }
  });

  it("reads the last part of the address, capitals as lower case", () => {
    expect(parseProjectSlug("kadal-vista")).toBe("kadal-vista");
    expect(parseProjectSlug("Kadal-Vista")).toBe("kadal-vista");
    expect(parseProjectSlug("kadal%2Dvista")).toBe("kadal-vista");
  });

  it("gives null, which is not found, for anything that is not a slug", () => {
    expect(parseProjectSlug("")).toBeNull();
    expect(parseProjectSlug("kadal vista")).toBeNull();
    expect(parseProjectSlug("kadal%20vista")).toBeNull();
    expect(parseProjectSlug("%E0%A4%A")).toBeNull();
    expect(parseProjectSlug("../secret")).toBeNull();
    expect(parseProjectSlug("kadal%2Fvista")).toBeNull();
  });

  it("sends a capital letter or an encoded character to the stored slug, and leaves the slug alone", () => {
    expect(canonicalProjectPath("kadal-vista", "kadal-vista")).toBeNull();
    expect(canonicalProjectPath("Kadal-Vista", "kadal-vista")).toBe("/projects/kadal-vista");
    expect(canonicalProjectPath("kadal%2Dvista", "kadal-vista")).toBeNull();
    expect(canonicalProjectPath("%E0%A4%A", "kadal-vista")).toBe("/projects/kadal-vista");
  });
});
