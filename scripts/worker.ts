import "dotenv/config";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { runAnalyticsRollup } from "@/lib/analytics/rollup";
import { getEnv, parseStartupEnv } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";
import { processDueCampaigns } from "@/lib/newsletter/campaigns";
import { sendWeeklyDigestIfDue } from "@/lib/newsletter/digest";
import { runExclusive } from "@/lib/jobs/lock";
import { JOBS, isDue, type JobDefinition } from "@/lib/jobs/schedule";
import { publishDueArticles } from "@/lib/content/service";
import { flushMessageDigests } from "@/lib/notifications/service";
import { cleanupRateLimits } from "@/lib/security/rate-limit-cleanup";

/**
 * Long-running scheduler. Ticks every 30 seconds and runs each job that is due, one at a time,
 * each under a Postgres advisory lock so two workers cannot run the same job at once.
 *
 * Run with `npm run worker` (tsx). A failing job is logged and the worker keeps going.
 * Last successful run times are stored in .data/worker-state.json (written atomically). If that file
 * is lost, daily jobs run once more on the next tick, which is safe because the rollup is idempotent.
 */

const TICK_MS = 30_000;
const STATE_FILE = path.resolve(".data", "worker-state.json");
const SHUTDOWN_GRACE_MS = 60_000;

type Outcome = "ok" | "error" | "skipped";

const handlers: Record<string, (now: Date) => Promise<unknown>> = {
  "notify-flush": async (now) => ({ sent: await flushMessageDigests(now) }),
  "analytics-rollup": async (now) => runAnalyticsRollup(now, null),
  "newsletter-campaigns": async (now) => ({ processed: await processDueCampaigns(now) }),
  "content-publish": async (now) => ({ published: await publishDueArticles(now) }),
  "newsletter-weekly-digest": async (now) => ({ sent: await sendWeeklyDigestIfDue(now) }),
  "rate-limit-cleanup": async (now) => ({ deleted: await cleanupRateLimits(now) }),
};

/** Logs one JSON line per event. Messages are trimmed; no env values, emails or request data are logged. */
function log(event: Record<string, unknown>): void {
  console.log(JSON.stringify({ at: new Date().toISOString(), ...event }));
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return message.slice(0, 300);
}

async function loadState(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(STATE_FILE, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

async function saveState(state: Record<string, string>): Promise<void> {
  await mkdir(path.dirname(STATE_FILE), { recursive: true });
  const tmp = `${STATE_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(state, null, 2));
  await rename(tmp, STATE_FILE); // atomic replace: a crash never leaves a half-written file
}

/** Last successful run per job. Persisted after each success so a restart does not repeat daily work. */
const lastSuccess = new Map<string, Date>();

async function runJob(job: JobDefinition, now: Date): Promise<void> {
  const started = Date.now();
  const handler = handlers[job.name];
  let outcome: Outcome;
  let detail: unknown;
  try {
    const result = await runExclusive(job.lockName, () => handler(now), { timeoutMs: job.timeoutMs });
    if (result.ran) {
      outcome = "ok";
      detail = result.value;
      lastSuccess.set(job.name, new Date());
      await saveState(Object.fromEntries([...lastSuccess].map(([name, at]) => [name, at.toISOString()])));
    } else {
      outcome = "skipped";
      detail = { reason: "another worker holds the lock" };
    }
  } catch (error) {
    outcome = "error";
    detail = { error: describeError(error) };
  }
  log({ job: job.name, outcome, durationMs: Date.now() - started, detail });
}

let stopping = false;
let currentTick: Promise<void> | undefined;

async function tick(): Promise<void> {
  const now = new Date();
  for (const job of JOBS) {
    if (stopping) return;
    if (!isDue(job, lastSuccess.get(job.name), now)) continue;
    await runJob(job, now);
  }
}

async function main(): Promise<void> {
  parseStartupEnv(process.env); // the same production rules as the web server, so a bad worker config fails at start
  getEnv();
  const saved = await loadState();
  for (const [name, iso] of Object.entries(saved)) {
    const time = new Date(iso);
    if (!Number.isNaN(time.getTime())) lastSuccess.set(name, time);
  }
  log({ event: "worker-start", jobs: JOBS.map((job) => job.name), tickMs: TICK_MS });

  const timer = setInterval(() => {
    if (stopping || currentTick) return;
    currentTick = tick().catch((error: unknown) => log({ event: "tick-error", error: describeError(error) })).finally(() => {
      currentTick = undefined;
    });
  }, TICK_MS);

  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    log({ event: "worker-stopping", signal });
    const force = setTimeout(() => {
      log({ event: "worker-forced-exit" });
      process.exit(1);
    }, SHUTDOWN_GRACE_MS);
    force.unref();
    void (async () => {
      await currentTick; // let the running job finish
      await prisma.$disconnect();
      log({ event: "worker-stopped" });
      process.exit(0);
    })();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // First tick now, so a fresh start does not wait 30 seconds.
  currentTick = tick().catch((error: unknown) => log({ event: "tick-error", error: describeError(error) })).finally(() => {
    currentTick = undefined;
  });
}

main().catch((error: unknown) => {
  log({ event: "worker-fatal", error: describeError(error) });
  process.exitCode = 1;
});
