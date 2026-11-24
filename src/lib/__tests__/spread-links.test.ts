import { describe, expect, it } from "vitest";
import { spreadLinks } from "../spread-links";

const make = (count: number) => Array.from({ length: count }, (_, index) => index + 1);
const sizes = (count: number) => spreadLinks(make(count)).map((column) => column.length);

describe("spreadLinks", () => {
  it("gives nothing for no links", () => {
    expect(spreadLinks([])).toEqual([]);
  });

  it("keeps up to 6 links in one column", () => {
    expect(sizes(1)).toEqual([1]);
    expect(sizes(6)).toEqual([6]);
  });

  it("spreads 7 and more evenly, longer columns first", () => {
    expect(sizes(7)).toEqual([4, 3]);
    expect(sizes(8)).toEqual([4, 4]);
    expect(sizes(12)).toEqual([6, 6]);
    expect(sizes(13)).toEqual([5, 4, 4]);
    expect(sizes(14)).toEqual([5, 5, 4]);
    expect(sizes(17)).toEqual([6, 6, 5]);
    expect(sizes(18)).toEqual([6, 6, 6]);
  });

  it("keeps the order and shows no more than 18", () => {
    const columns = spreadLinks(make(20));
    expect(columns.flat()).toEqual(make(18));
    expect(columns).toHaveLength(3);
  });
});
