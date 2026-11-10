import { z } from "zod";

/**
 * Validated environment. Use `getEnv()` instead of reading process.env directly.
 * Validation runs on first use (not on import), so tests and tooling can load
 * modules without a full environment. Throws if required variables are invalid.
 */
/** Optional string where an empty value (e.g. copied from .env.example) counts as unset. */
const optionalText = z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional());

const schema = z
  .object({
    DATABASE_URL: z.string().url({ message: "DATABASE_URL must be a valid URL" }),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /** Public address of the site (links in email, metadata, referral links). Required in production. */
    APP_URL: z.string().url({ message: "APP_URL must be a full URL, e.g. https://gemstones.example" }).optional(),

    // Auth.js signs session cookies with this. Required in production.
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters").optional(),

    // Admin seed (prisma/seed.ts). Both optional; seeding skips admin if unset.
    ADMIN_EMAIL: z.string().email().optional(),
    ADMIN_PASSWORD: z.string().min(10).optional(),

    // Providers. "console" logs to stdout and is only allowed outside production.
    // "resend" (email) and "msg91" (SMS) need their keys below; the factories refuse to send without them.
    EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
    SMS_PROVIDER: z.enum(["console", "msg91"]).default("console"),

    // Resend (email). EMAIL_FROM is the verified sender, e.g. "Gemstone Selections <no-reply@your-domain>".
    RESEND_API_KEY: optionalText,
    EMAIL_FROM: optionalText,

    // MSG91 (SMS). Sender ID is the 6-character DLT sender; TEMPLATE_ID is the DLT-approved Flow id.
    MSG91_AUTH_KEY: optionalText,
    MSG91_SENDER_ID: optionalText,
    MSG91_TEMPLATE_ID: optionalText,
    /**
     * Test-only opt-in. Console providers never deliver mail, so they are refused in production
     * unless this is "true". Only the end-to-end run sets it (playwright.config.ts). Never set it on a real host.
     */
    ALLOW_NON_DELIVERING_PROVIDERS: z.enum(["true", "false"]).default("false"),

    // Local-disk storage root. Must NOT be inside /public.
    STORAGE_DIR: z.string().min(1).default("./.data/uploads"),
    UPLOAD_MAX_MB: z.coerce.number().positive().max(50).default(10),

    /** Demo seed opt-in. Demo data is refused unless this is "true", in addition to the NODE_ENV check. */
    ALLOW_DEMO_SEED: z.enum(["true", "false"]).default("false"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && !env.APP_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message: "APP_URL is required in production (the public address, e.g. https://gemstones.example). Links in email and referral codes depend on it.",
      });
    }
  })
  .transform((env) => ({ ...env, APP_URL: env.APP_URL ?? "http://localhost:3000" }));
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
