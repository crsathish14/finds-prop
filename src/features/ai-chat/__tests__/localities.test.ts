import { describe, expect, it } from "vitest";
import {
  countLocalities,
  editDistance,
  findLocalities,
  localityKey,
  type LocalityCount,
} from "../localities";

// UT-ai-localities (ADR-128 sections 3 and 5.1): grouping the typed locality names, counting them, and
// finding the ones that look like what a customer wrote. The names are real places; the counts are made up.

const locality = (name: string, homes: number, projects = 0): LocalityCount => ({
  name,
  homes,
  projects,
});

describe("UT-ai-localities: one locality however it is spelt", () => {
  it("reads capitals, dots and extra spaces as the same name", () => {
    expect(localityKey("T. Nagar")).toBe("t nagar");
    expect(localityKey("T.Nagar")).toBe("t nagar");
    expect(localityKey("  t   NAGAR ")).toBe("t nagar");
  });

  it("keeps Tamil letters and their vowel signs", () => {
    expect(localityKey("வேளச்சேரி")).toBe("வேளச்சேரி");
    expect(localityKey(" அடையார், ")).toBe("அடையார்");
  });

  it("gives nothing for a name with no letter or digit", () => {
    expect(localityKey(" -- ")).toBe("");
  });
});

describe("UT-ai-localities: counting", () => {
  it("counts homes and projects apart, each locality once", () => {
    expect(
      countLocalities(["Velachery", "velachery", "Adyar", "Velachery "], ["Adyar", "Porur"]),
    ).toEqual([
      { name: "Velachery", homes: 3, projects: 0 },
      { name: "Adyar", homes: 1, projects: 1 },
      { name: "Porur", homes: 0, projects: 1 },
    ]);
  });

  it("shows the spelling most listings use, and of two used equally the one that sorts first", () => {
    expect(countLocalities(["anna nagar", "Anna Nagar", "Anna Nagar"], [])[0]?.name).toBe(
      "Anna Nagar",
    );
    expect(countLocalities(["anna nagar", "Anna Nagar"], [])[0]?.name).toBe("Anna Nagar");
  });

  it("puts the busiest first and equally busy ones in the order of their names", () => {
    expect(
      countLocalities(["Porur", "Adyar", "Guindy", "Guindy"], []).map((entry) => entry.name),
    ).toEqual(["Guindy", "Adyar", "Porur"]);
  });

  it("leaves out a name with nothing in it", () => {
    expect(countLocalities(["  ", "--", "Adyar"], [""])).toEqual([
      { name: "Adyar", homes: 1, projects: 0 },
    ]);
  });
});

describe("UT-ai-localities: how far apart two spellings are", () => {
  it.each([
    ["velachery", "velachery", 0],
    ["velacheri", "velachery", 1],
    ["tiruvanmiyur", "thiruvanmiyur", 1],
    ["adayar", "adyar", 1],
    ["palavanthangal", "pazhavanthangal", 2],
  ])("%s to %s is %i", (first, second, expected) => {
    expect(editDistance(first, second, 3)).toBe(expected);
  });

  it("stops counting once the limit is passed", () => {
    expect(editDistance("guindy", "velachery", 2)).toBe(3);
    expect(editDistance("ab", "abcdefgh", 2)).toBe(3);
  });

  it("counts a Tamil letter or sign as one change", () => {
    expect(editDistance("அடையார்", "அடயார்", 2)).toBe(1);
  });
});

describe("UT-ai-localities: finding what the customer wrote", () => {
  const LISTED = [
    locality("Velachery", 12, 1),
    locality("Anna Nagar", 9),
    locality("Adyar", 7, 2),
    locality("Thiruvanmiyur", 4),
    locality("Anna Nagar West", 3),
    locality("T. Nagar", 2),
    locality("West Mambalam", 1),
  ];
  const names = (search: string | null, limit = 10) =>
    findLocalities(LISTED, search, limit).map((entry) => entry.name);

  it("gives the busiest localities when no text is given", () => {
    expect(names(null, 3)).toEqual(["Velachery", "Anna Nagar", "Adyar"]);
    expect(names("   ", 2)).toEqual(["Velachery", "Anna Nagar"]);
  });

  it("finds Velachery for Velacheri, the spelling mistake of the ADR", () => {
    expect(names("Velacheri")).toEqual(["Velachery"]);
  });

  it("finds a name through a missing letter, a doubled letter and a dropped space", () => {
    expect(names("Tiruvanmiyur")).toEqual(["Thiruvanmiyur"]);
    expect(names("Adayar")).toEqual(["Adyar"]);
    expect(names("tnagar")).toEqual(["T. Nagar"]);
  });

  it("puts the same name first, then names that start with the text, then names that hold it", () => {
    expect(names("anna nagar")).toEqual(["Anna Nagar", "Anna Nagar West"]);
    expect(names("west")).toEqual(["West Mambalam", "Anna Nagar West"]);
    expect(names("nagar")).toEqual(["Anna Nagar", "Anna Nagar West", "T. Nagar"]);
  });

  it("does not guess from very short text", () => {
    expect(names("xy")).toEqual([]);
    expect(names("ady")).toEqual(["Adyar"]);
  });

  it("gives nothing when no listed name is close", () => {
    expect(names("Coimbatore")).toEqual([]);
  });

  it("never gives more than the limit", () => {
    expect(names("a", 2)).toHaveLength(2);
  });
});
