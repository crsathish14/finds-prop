import { describe, expect, it } from "vitest";
import { extraRows } from "@/features/projects/view";
import {
  boxesFor,
  cleanExtras,
  EXTRA_VALUE_MAX,
  missingExtras,
  type ExtraBox,
} from "../extra-fields";
import { extraFieldsOf } from "../view";

const box = (patch: Partial<ExtraBox> = {}): ExtraBox => ({
  id: "fa000000001",
  label: "Approval no.",
  required: false,
  appliesTo: [],
  on: true,
  ...patch,
});

describe("UT-extra-fields: the extra project form boxes (ADR-168)", () => {
  it("asks only for boxes that are on and apply to the property type", () => {
    const boxes = [
      box(),
      box({ id: "fb000000002", appliesTo: ["plot"] }),
      box({ id: "fc000000003", on: false }),
    ];
    expect(boxesFor(boxes, "villa").map((one) => one.id)).toEqual(["fa000000001"]);
    expect(boxesFor(boxes, "plot").map((one) => one.id)).toEqual(["fa000000001", "fb000000002"]);
  });

  it("reports a required box that is blank, but not one that is off or does not apply", () => {
    const boxes = [
      box({ required: true }),
      box({ id: "fb000000002", required: true, appliesTo: ["plot"] }),
      box({ id: "fc000000003", required: true, on: false }),
    ];
    expect(missingExtras(boxes, "villa", { fa000000001: "  " })).toEqual(["fa000000001"]);
    expect(missingExtras(boxes, "villa", { fa000000001: "x" })).toEqual([]);
    expect(missingExtras(boxes, "plot", { fa000000001: "x" })).toEqual(["fb000000002"]);
  });

  it("keeps answers of boxes that still exist (even off), drops deleted ones and blanks, cuts the length", () => {
    const boxes = [box(), box({ id: "fc000000003", on: false })];
    const long = "a".repeat(EXTRA_VALUE_MAX + 20);
    expect(
      cleanExtras(boxes, {
        fa000000001: ` ${long} `,
        fc000000003: "kept while off",
        fz000000009: "box was deleted",
      }),
    ).toEqual({ fa000000001: "a".repeat(EXTRA_VALUE_MAX), fc000000003: "kept while off" });
    expect(cleanExtras(boxes, { fa000000001: "  " })).toEqual({});
    expect(cleanExtras(boxes, { fa000000001: "bad\u0007text" })).toEqual({
      fa000000001: "badtext",
    });
  });

  it("reads stored answers as text only", () => {
    expect(extraFieldsOf({ ab: "x", bc: 5, cd: null })).toEqual({ ab: "x" });
    expect(extraFieldsOf(null)).toEqual({});
    expect(extraFieldsOf(["x"])).toEqual({});
  });

  it("shows on the project page only answered boxes that are on and apply, in the admin's order", () => {
    const defs = [
      { id: "fa", label: "First", appliesTo: [], on: true },
      { id: "fb", label: "Second", appliesTo: ["plot"], on: true },
      { id: "fc", label: "Third", appliesTo: [], on: false },
      { id: "fd", label: "Fourth", appliesTo: [], on: true },
    ];
    const answers = { fa: " one ", fb: "two", fc: "three", fd: "" };
    expect(extraRows(defs, "villa", answers)).toEqual([{ id: "fa", label: "First", value: "one" }]);
    expect(extraRows(defs, "plot", answers).map((row) => row.id)).toEqual(["fa", "fb"]);
    expect(extraRows(defs, null, answers).map((row) => row.id)).toEqual(["fa"]);
  });
});
