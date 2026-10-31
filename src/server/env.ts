import "server-only";
import { z } from "zod";

/**
 * Server-side configuration, validated once when this module is first imported. A missing or
 * malformed value stops the build or the boot with a message that lists variable NAMES only.
 *
 * Layout rule (checked by scripts/check-env.mjs): one variable per line.
 * Provider keys are optional until the stage that needs them; flags are off by default.
 */
const flag = z
  .enum(["0", "1", "true", "false"])
  .default("0")
  .transform((value) => value === "1" || value === "true");

const serverEnvSchema = z.object({
  APP_ENV: z.enum(["local", "dev", "staging", "production"]).default("local"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SEND_SMS_HOOK_SECRET: z.string().min(1).optional(),
  MSG91_AUTH_KEY: z.string().min(1).optional(),
  MSG91_TEMPLATE_ID: z.string().min(1).optional(),
  MSG91_SENDER_ID: z.string().min(1).optional(),
  OLA_MAPS_API_KEY: z.string().min(1).optional(),
  RATE_LIMIT_HMAC_SECRET: z.string().min(32).optional(),
  SENTRY_DSN: z.url().optional(),
  SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
  FLAG_AI_SEARCH: flag,
  FLAG_MAP_VIEW: flag,
  FLAG_PG_LISTINGS: flag,
  DESIGN_LAB: flag,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const cleaned = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, value === "" ? undefined : value]),
  );
  const parsed = serverEnvSchema.safeParse(cleaned);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "?")))];
    // Names only: never print the values.
    throw new Error(`Invalid server environment variables: ${names.join(", ")}`);
  }
  return parsed.data;
}

export const env: ServerEnv = parseServerEnv(process.env);

/**
 * The Design Lab (ADR-020) is for development and review. It needs DESIGN_LAB=1 and is never
 * served by a production deployment, whatever the flag says.
 */
export function isDesignLabEnabled(settings: Pick<ServerEnv, "DESIGN_LAB" | "APP_ENV">): boolean {
  return settings.DESIGN_LAB && settings.APP_ENV !== "production";
}

export const designLabEnabled: boolean = isDesignLabEnabled(env);
