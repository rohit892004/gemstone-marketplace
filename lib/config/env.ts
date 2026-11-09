import { z } from "zod";

/**
 * Validated environment. Use `getEnv()` instead of reading process.env directly.
 * Validation runs on first use (not on import), so tests and tooling can load
 * modules without a full environment. Throws if required variables are invalid.
 */
const schema = z
  .object({
    DATABASE_URL: z.string().url({ message: "DATABASE_URL must be a valid URL" }),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.string().url().default("http://localhost:3000"),

    // Auth.js signs session cookies with this. Required in production.
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters").optional(),

    // Admin seed (prisma/seed.ts). Both optional; seeding skips admin if unset.
    ADMIN_EMAIL: z.string().email().optional(),
    ADMIN_PASSWORD: z.string().min(10).optional(),

    // Providers. "console" logs to stdout and is only allowed outside production.
    EMAIL_PROVIDER: z.enum(["console"]).default("console"),
    SMS_PROVIDER: z.enum(["console"]).default("console"),

    // Local-disk storage root. Must NOT be inside /public.
    STORAGE_DIR: z.string().min(1).default("./.data/uploads"),
    UPLOAD_MAX_MB: z.coerce.number().positive().max(50).default(10),
  });
// Production-only rules (console providers, AUTH_SECRET) are enforced where the
// feature is used, not here. Validating them at import would break `next build`,
// which imports route modules while collecting pages.

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Test-only: clears the cached env so tests can change process.env. */
export function resetEnvCacheForTests(): void {
  cached = undefined;
}
