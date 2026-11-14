import { describe, expect, it } from "vitest";
import { createLogger, withLogContext } from "@/server/logger";

describe("UT-logger-context: fields that belong to a whole request", () => {
  function capture() {
    const lines: Record<string, unknown>[] = [];
    const log = createLogger({}, { write: (line) => void lines.push(JSON.parse(line)) });
    return { lines, log };
  }

  it("puts the request id on every line written inside, by any logger, also after an await", async () => {
    const { lines, log } = capture();
    const other = createLogger(
      { route: "child" },
      { write: (line) => void lines.push(JSON.parse(line)) },
    );
    await withLogContext({ requestId: "request-id-12345" }, async () => {
      log.info("first");
      await Promise.resolve();
      other.warn("second");
    });
    log.info("outside");
    expect(lines.map((line) => line.requestId)).toEqual([
      "request-id-12345",
      "request-id-12345",
      undefined,
    ]);
    expect(lines[1]?.route).toBe("child");
  });

  it("lets a field written in the line, or by a child logger, win over the request's", () => {
    const { lines, log } = capture();
    withLogContext({ requestId: "from-context", route: "ai-chat" }, () => {
      log.info("line", { route: "from-line" });
      log.child({ requestId: "from-child" }).info("child");
    });
    expect(lines.map((line) => [line.requestId, line.route])).toEqual([
      ["from-context", "from-line"],
      ["from-child", "ai-chat"],
    ]);
  });

  it("keeps two requests apart when they run at the same time", async () => {
    const { lines, log } = capture();
    await Promise.all(
      ["request-one-111", "request-two-222"].map((requestId) =>
        withLogContext({ requestId }, async () => {
          await new Promise((resolve) =>
            setTimeout(resolve, requestId === "request-one-111" ? 20 : 5),
          );
          log.info("done");
        }),
      ),
    );
    expect(lines.map((line) => line.requestId).sort()).toEqual([
      "request-one-111",
      "request-two-222",
    ]);
  });

  it("still redacts what it writes", () => {
    const { lines, log } = capture();
    withLogContext({ requestId: "request-id-12345" }, () =>
      log.info("line", { message: "call 98765 43210" }),
    );
    expect(JSON.stringify(lines[0])).not.toContain("98765");
  });
});
