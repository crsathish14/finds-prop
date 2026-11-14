import { AsyncLocalStorage } from "node:async_hooks";
import { env } from "../env";
import { redactValue } from "@/lib/redact";

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Fields that belong to everything logged while one request is being handled, wherever the line is written. */
const requestFields = new AsyncLocalStorage<Readonly<Record<string, unknown>>>();

/**
 * Runs `work` so that every line logged inside it, by any logger and any module it calls, carries `fields`
 * (the request id, the route). A streaming handler uses it because the agent loop, the tools and the guards
 * log through the shared logger, and R-BE-10 wants the request id on every line. A field written in the
 * line itself, or by a `child` logger, wins over one set here.
 */
export function withLogContext<Result>(fields: LogFields, work: () => Result): Result {
  return requestFields.run({ ...requestFields.getStore(), ...fields }, work);
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LogFields {
  requestId?: string;
  route?: string;
  userId?: string;
  role?: string;
  durationMs?: number;
  errorCode?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

export interface LoggerOptions {
  /** Lowest level that is written. Defaults to "info". */
  level?: LogLevel;
  /** Where lines go. Defaults to standard output as one JSON object per line. */
  write?: (line: string) => void;
  now?: () => Date;
}

function stdoutWrite(line: string): void {
  process.stdout.write(`${line}\n`);
}

/**
 * The only logging entry point in application code. Every line is one JSON object with the
 * fixed fields from plan 07 section 12, and every value passes through redaction first.
 */
export function createLogger(base: LogFields = {}, options: LoggerOptions = {}): Logger {
  const threshold = LEVEL_ORDER[options.level ?? "info"];
  const write = options.write ?? stdoutWrite;
  const now = options.now ?? (() => new Date());

  const emit = (level: LogLevel, message: string, fields: LogFields = {}): void => {
    if (LEVEL_ORDER[level] < threshold) return;
    const line = redactValue({
      level,
      msg: message,
      time: now().toISOString(),
      ...requestFields.getStore(),
      ...base,
      ...fields,
    });
    write(JSON.stringify(line));
  };

  return {
    debug: (message, fields) => emit("debug", message, fields),
    info: (message, fields) => emit("info", message, fields),
    warn: (message, fields) => emit("warn", message, fields),
    error: (message, fields) => emit("error", message, fields),
    child: (fields) => createLogger({ ...base, ...fields }, options),
  };
}

/** Shared logger for application code. Debug lines are written outside production only. */
export const logger: Logger = createLogger(
  {},
  { level: env.APP_ENV === "production" ? "info" : "debug" },
);
