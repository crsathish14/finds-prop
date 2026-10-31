import { env } from "../env";
import { redactValue } from "./redact";

export type LogLevel = "debug" | "info" | "warn" | "error";

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
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
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

  const emit = (level: LogLevel, msg: string, fields: LogFields = {}): void => {
    if (LEVEL_ORDER[level] < threshold) return;
    const line = redactValue({ level, msg, time: now().toISOString(), ...base, ...fields });
    write(JSON.stringify(line));
  };

  return {
    debug: (msg, fields) => emit("debug", msg, fields),
    info: (msg, fields) => emit("info", msg, fields),
    warn: (msg, fields) => emit("warn", msg, fields),
    error: (msg, fields) => emit("error", msg, fields),
    child: (fields) => createLogger({ ...base, ...fields }, options),
  };
}

/** Shared logger for application code. Debug lines are written outside production only. */
export const logger: Logger = createLogger(
  {},
  { level: env.APP_ENV === "production" ? "info" : "debug" },
);
