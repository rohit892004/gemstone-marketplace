import { z } from "zod";

/**
 * Validated environment. Use `getEnv()` instead of reading process.env directly.
 * Validation runs on first use (not on import), so tests and tooling can load
 * modules without a full environment. Throws if required variables are invalid.
 *
 * When NODE_ENV=production the production rule set (productionProblems) also runs. Every
 * problem is listed in one error so an operator can fix them in a single pass.
 */
/** Optional string where an empty value (e.g. copied from .env.example) counts as unset. */
const optionalText = z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional());

/** Optional boolean flag written as "true" or "false"; empty counts as unset (false). */
const flag = z.enum(["true", "false"]).default("false");

const schema = z
  .object({
    DATABASE_URL: z.string().url({ message: "DATABASE_URL must be a valid URL" }),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /** Public address of the site (links in email, metadata, referral links). Required in production. */
    APP_URL: z.string().url({ message: "APP_URL must be a full URL, e.g. https://gemstones.example" }).optional(),

    // Auth.js signs session cookies with this. Required in production (see productionProblems).
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters").optional(),

    // Admin seed (prisma/seed.ts). Both optional; seeding skips admin if unset.
    ADMIN_EMAIL: z.string().email().optional(),
    ADMIN_PASSWORD: z.string().min(10).optional(),

    // Providers. "console" logs to stdout and is refused in production unless ALLOW_NON_DELIVERING_PROVIDERS=true.
    EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
    SMS_PROVIDER: z.enum(["console", "msg91"]).default("console"),

    // Resend (email). EMAIL_FROM is the verified sender, e.g. "Gemstone Selections <no-reply@your-domain>".
    RESEND_API_KEY: optionalText,
    EMAIL_FROM: optionalText,
    /** Svix signing secret for the Resend webhook route. Must start with "whsec_" when set. */
    RESEND_WEBHOOK_SECRET: optionalText.refine((value) => value === undefined || value.startsWith("whsec_"), {
      message: "RESEND_WEBHOOK_SECRET must start with whsec_",
    }),

    // MSG91 (SMS). Sender ID is the 6-character DLT sender; TEMPLATE_ID is the DLT-approved Flow id.
    MSG91_AUTH_KEY: optionalText,
    MSG91_SENDER_ID: optionalText,
    MSG91_TEMPLATE_ID: optionalText,
    /**
     * Test-only opt-in. Console providers never deliver mail, so they are refused in production
     * unless this is "true". ONLY the end-to-end run sets it (playwright.config.ts), against a
     * local production-mode server. Never set it on a real host.
     */
    ALLOW_NON_DELIVERING_PROVIDERS: flag,

    // Local-disk storage root. Must NOT be inside /public.
    STORAGE_DIR: z.string().min(1).default("./.data/uploads"),
    UPLOAD_MAX_MB: z.coerce.number().positive().max(50).default(10),

    /**
     * Private object storage. "local" writes to STORAGE_DIR. "s3" uses any S3-compatible service
     * (AWS S3, Cloudflare R2, DigitalOcean Spaces) and needs the S3_* values below.
     */
    STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
    S3_BUCKET: optionalText,
    S3_REGION: optionalText,
    /** Custom endpoint for R2 / Spaces, e.g. https://<account>.r2.cloudflarestorage.com. Leave unset for AWS. */
    S3_ENDPOINT: optionalText,
    S3_ACCESS_KEY_ID: optionalText,
    S3_SECRET_ACCESS_KEY: optionalText,
    S3_FORCE_PATH_STYLE: flag,

    /** Number of trusted reverse proxies in front of the app (0 = none, max 5). See lib/security/client-ip.ts. */
    TRUSTED_PROXY_COUNT: z.coerce.number().int().min(0).max(5).default(1),

    /** Demo seed opt-in. Demo data is refused unless this is "true", and never in production. */
    ALLOW_DEMO_SEED: flag,

    /** Error monitoring (Sentry). Off unless set. Format: https://<key>@<host>/<project-id>. */
    SENTRY_DSN: optionalText,
  })
  .transform((env) => ({ ...env, APP_URL: env.APP_URL ?? "http://localhost:3000" }));

export type Env = z.infer<typeof schema>;

/**
 * Production rules. Works on the raw source so every problem is reported at once, including
 * problems in variables that failed the base schema. Returns human-readable lines.
 */
export function productionProblems(source: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  const value = (name: string) => (source[name] === "" ? undefined : source[name]);

  const allowNonDelivering = source.ALLOW_NON_DELIVERING_PROVIDERS === "true";
  const appUrl = value("APP_URL");
  if (!appUrl) {
    problems.push("APP_URL is required in production (the public address, e.g. https://gemstones.example). Links in email and referral codes depend on it.");
  } else if (!allowNonDelivering && !/^https:\/\//i.test(appUrl)) {
    // The e2e run serves http://localhost (ALLOW_NON_DELIVERING_PROVIDERS=true only), so the https rule is skipped there.
    problems.push("APP_URL must use https:// in production.");
  }

  const authSecret = value("AUTH_SECRET");
  if (!authSecret || authSecret.length < 32) {
    problems.push("AUTH_SECRET is required in production and must be at least 32 characters (generate one with: openssl rand -base64 48).");
  }

  const emailProvider = value("EMAIL_PROVIDER") ?? "console";
  const smsProvider = value("SMS_PROVIDER") ?? "console";
  if (emailProvider === "console" && !allowNonDelivering) {
    problems.push("EMAIL_PROVIDER=console does not deliver email. Set EMAIL_PROVIDER=resend in production.");
  }
  if (smsProvider === "console" && !allowNonDelivering) {
    problems.push("SMS_PROVIDER=console does not deliver SMS. Set SMS_PROVIDER=msg91 in production.");
  }
  if (emailProvider === "resend" && (!value("RESEND_API_KEY") || !value("EMAIL_FROM"))) {
    problems.push("EMAIL_PROVIDER=resend needs RESEND_API_KEY and EMAIL_FROM.");
  }
  if (smsProvider === "msg91" && (!value("MSG91_AUTH_KEY") || !value("MSG91_SENDER_ID") || !value("MSG91_TEMPLATE_ID"))) {
    problems.push("SMS_PROVIDER=msg91 needs MSG91_AUTH_KEY, MSG91_SENDER_ID and MSG91_TEMPLATE_ID.");
  }

  if (source.ALLOW_DEMO_SEED === "true") {
    problems.push("ALLOW_DEMO_SEED=true is refused in production. Demo data must never reach a live site.");
  }

  if ((value("STORAGE_PROVIDER") ?? "local") === "s3") {
    if (!value("S3_BUCKET") || !value("S3_ACCESS_KEY_ID") || !value("S3_SECRET_ACCESS_KEY")) {
      problems.push("STORAGE_PROVIDER=s3 needs S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
    }
  }

  return problems;
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  const problems: string[] = [];
  if (!result.success) {
    for (const issue of result.error.issues) {
      problems.push(`${issue.path.join(".")}: ${issue.message}`);
    }
  }
  if (source.NODE_ENV === "production") {
    problems.push(...productionProblems(source));
  }
  if (problems.length > 0 || !result.success) {
    throw new Error(`Invalid environment configuration:\n${problems.map((line) => `  - ${line}`).join("\n")}`);
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
