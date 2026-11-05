import { describe, expect, it } from "vitest";
import {
  canonicalPropertyPath,
  parsePropertyAddress,
  propertyPath,
  propertySegment,
} from "../address";

describe("UT-property-address: /properties/{slug}-{shortId} (ADR-025)", () => {
  it("builds the address of a home", () => {
    expect(propertySegment("3-bhk-velachery", "k3x9a2bd")).toBe("3-bhk-velachery-k3x9a2bd");
    expect(propertyPath("3-bhk-velachery", "k3x9a2bd")).toBe(
      "/properties/3-bhk-velachery-k3x9a2bd",
    );
  });

  it("reads the slug and the public id", () => {
    expect(parsePropertyAddress("3-bhk-apartment-velachery-k3x9a2bd")).toEqual({
      slug: "3-bhk-apartment-velachery",
      shortId: "k3x9a2bd",
    });
  });

  it("reads a slug that is one word", () => {
    expect(parsePropertyAddress("property-k3x9a2bd")).toEqual({
      slug: "property",
      shortId: "k3x9a2bd",
    });
  });

  it("reads capitals as lower case and a percent-encoded address", () => {
    expect(parsePropertyAddress("Velachery-K3X9A2BD")).toEqual({
      slug: "velachery",
      shortId: "k3x9a2bd",
    });
    expect(parsePropertyAddress("velachery%2Dk3x9a2bd")?.shortId).toBe("k3x9a2bd");
  });

  it("gives null for anything that is not a slug, a dash and an id", () => {
    for (const bad of [
      "",
      "k3x9a2bd",
      "-k3x9a2bd",
      "velachery-k3x9a2b",
      "velachery-k3x9a2bdd",
      "velachery_k3x9a2bd",
      // the id alphabet has no 0, 1, i, l, o
      "velachery-k3x9a2b0",
      "velachery-k3x9a2bl",
      "velachery-k3x9a2bi",
      "velachery k3x9a2bd",
      "velachery/..-k3x9a2bd",
      "velachery-%E0%A4%A",
      `${"a".repeat(101)}-k3x9a2bd`,
    ]) {
      expect(parsePropertyAddress(bad), bad).toBeNull();
    }
  });
});

describe("UT-property-address: the canonical address", () => {
  const stored = { slug: "3-bhk-velachery", shortId: "k3x9a2bd" };

  it("leaves the canonical address alone", () => {
    expect(canonicalPropertyPath("3-bhk-velachery-k3x9a2bd", stored)).toBeNull();
  });

  it("sends an old or edited slug to the stored one", () => {
    expect(canonicalPropertyPath("old-title-k3x9a2bd", stored)).toBe(
      "/properties/3-bhk-velachery-k3x9a2bd",
    );
  });

  it("sends capitals to the lower-case address", () => {
    expect(canonicalPropertyPath("3-BHK-Velachery-K3X9A2BD", stored)).toBe(
      "/properties/3-bhk-velachery-k3x9a2bd",
    );
  });

  it("is a fixed point: the canonical address is its own canonical form", () => {
    const path = canonicalPropertyPath("old-k3x9a2bd", stored) ?? "";
    expect(canonicalPropertyPath(path.replace("/properties/", ""), stored)).toBeNull();
  });
});
