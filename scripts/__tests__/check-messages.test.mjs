import { afterAll, describe, expect, it } from "vitest";
import { checkMessages, parseMessage } from "../check-messages.mjs";
import { cleanupTrees, makeTree, rules } from "./helpers.mjs";

afterAll(cleanupTrees);

const EN = JSON.stringify({
  home: { title: "Find Prop" },
  errors: { RATE_LIMITED: "Try again in {minutes} minutes." },
  common: { items: "{count, plural, one {# item} other {# items}}" },
});
const USER =
  'const title = translate("home.title");\nconst error = translate(`errors.${code}`);\nconst items = translate("common.items", { count });\n';

const run = (messages = {}, src = USER) => {
  const tree = {
    "src/i18n/messages/en.json": EN,
    "src/app/page.tsx": src,
    ...messages,
  };
  const root = makeTree(tree, { withPolicy: false });
  return checkMessages({ root, files: Object.keys(tree) });
};

describe("G-21 check-messages: message syntax", () => {
  it("finds variables at any depth, including inside plural branches", () => {
    expect(
      [...parseMessage("Hi {name}, {n, plural, one {# new} other {# new for {who}}}").args].sort(),
    ).toEqual(["n", "name", "who"]);
  });

  it("reports unbalanced braces and apostrophes before a brace", () => {
    expect(parseMessage("Hello {name").problems.join()).toContain("never closed");
    expect(parseMessage("Hello name}").problems.join()).toContain("no opening brace");
    expect(parseMessage("Use '{name}' here").problems.join()).toContain("apostrophe");
  });

  it("allows a plain apostrophe in a word", () => {
    expect(parseMessage("We couldn't find that").problems).toEqual([]);
  });
});

describe("G-21 check-messages: en.json", () => {
  it("passes a clean file in which every key is used", () => {
    expect(run()).toEqual([]);
  });

  it("fails when en.json is missing", () => {
    const root = makeTree({ "src/app/page.tsx": USER }, { withPolicy: false });
    expect(rules(checkMessages({ root, files: ["src/app/page.tsx"] }))).toContain("MSG-FILE");
  });

  it("fails on invalid JSON", () => {
    expect(rules(run({ "src/i18n/messages/en.json": "{ nope" }))).toContain("MSG-JSON");
  });

  it("fails on empty text, stray spaces and HTML", () => {
    const bad = JSON.stringify({ home: { title: "", sub: " hi ", rich: "Click <b>here</b>" } });
    const out = rules(
      run(
        { "src/i18n/messages/en.json": bad },
        'translate("home.title"); translate("home.sub"); translate("home.rich");',
      ),
    );
    expect(out).toEqual(expect.arrayContaining(["MSG-EMPTY", "MSG-SPACE", "MSG-HTML"]));
  });

  it("fails on arrays, numbers and odd key names", () => {
    const bad = JSON.stringify({ "bad-key": "x", list: ["first"], count: 3 });
    expect(rules(run({ "src/i18n/messages/en.json": bad }))).toEqual(
      expect.arrayContaining(["MSG-KEY", "MSG-SHAPE"]),
    );
  });

  it("fails on a broken variable", () => {
    const bad = JSON.stringify({ home: { title: "Hello {name" } });
    expect(rules(run({ "src/i18n/messages/en.json": bad }, 'translate("home.title")'))).toContain(
      "MSG-ICU",
    );
  });

  it("fails on a key nobody reads", () => {
    const out = run({}, 'translate("home.title"); translate(`errors.${code}`);');
    expect(
      out.some(
        (finding) => finding.rule === "MSG-UNUSED" && finding.message.includes("common.items"),
      ),
    ).toBe(true);
  });

  it("counts a namespace plus a key, a dynamic prefix and a direct read as use", () => {
    const en = JSON.stringify({ group: { item: "x" }, dyn: { one: "y" }, problem: { title: "z" } });
    const src =
      'const translate = getTranslations("group"); translate("item");\nconst dynamicKey = `dyn.${name}`;\nconst direct = en.problem.title;\n';
    expect(run({ "src/i18n/messages/en.json": en }, src)).toEqual([]);
  });

  it("does not count a test file as use", () => {
    const tree = {
      "src/i18n/messages/en.json": JSON.stringify({ group: { item: "x" } }),
      "src/app/page.tsx": "export {};\n",
      "src/app/__tests__/page.test.tsx": 'translate("group.item")',
    };
    const root = makeTree(tree, { withPolicy: false });
    expect(rules(checkMessages({ root, files: Object.keys(tree) }))).toContain("MSG-UNUSED");
  });
});

describe("G-21 check-messages: other languages", () => {
  it("passes a complete translation with the same variables", () => {
    const ta = JSON.stringify({
      home: { title: "ஃபைண்ட் ப்ராப்" },
      errors: { RATE_LIMITED: "{minutes} நிமிடங்களில் முயலவும்." },
      common: { items: "{count, plural, one {# பொருள்} other {# பொருட்கள்}}" },
    });
    expect(run({ "src/i18n/messages/ta.json": ta })).toEqual([]);
  });

  it("fails on a missing key, an extra key and a changed variable", () => {
    const ta = JSON.stringify({
      home: { title: "x", extra: "y" },
      errors: { RATE_LIMITED: "{mins} min" },
    });
    const out = run({ "src/i18n/messages/ta.json": ta });
    const parity = out
      .filter((finding) => finding.rule === "MSG-PARITY")
      .map((finding) => finding.message);
    expect(parity.some((message) => message.includes('"common.items" is missing'))).toBe(true);
    expect(parity.some((message) => message.includes('"home.extra" is not in en.json'))).toBe(true);
    expect(
      parity.some((message) => message.includes("{mins}") && message.includes("{minutes}")),
    ).toBe(true);
  });
});
