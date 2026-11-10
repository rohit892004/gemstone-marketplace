/**
 * The worker's job list, as pure data, plus the due-time rule. No I/O here, so the rules are unit tested.
 *
 * Times are UTC instants. Daily jobs are expressed in IST wall-clock time (India has no DST, so the
 * offset is fixed at +05:30).
 */

export const IST_OFFSET_MINUTES = 5 * 60 + 30;

export type Schedule =
  | { kind: "interval"; everyMs: number }
  | { kind: "daily-ist"; hour: number; minute: number };

export interface JobDefinition {
  /** Stable name used in logs and in the worker state file. */
  name: string;
  /** Postgres advisory lock name (see lib/jobs/lock.ts). Two workers cannot run one job at once. */
  lockName: string;
  schedule: Schedule;
  /** Upper bound for the job's transaction and lock. */
  timeoutMs: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const JOBS: readonly JobDefinition[] = [
  { name: "notify-flush", lockName: "job:notify-flush", schedule: { kind: "interval", everyMs: 5 * MINUTE }, timeoutMs: 5 * MINUTE },
  { name: "analytics-rollup", lockName: "job:analytics-rollup", schedule: { kind: "daily-ist", hour: 0, minute: 30 }, timeoutMs: 30 * MINUTE },
  { name: "newsletter-campaigns", lockName: "job:newsletter-campaigns", schedule: { kind: "interval", everyMs: MINUTE }, timeoutMs: 10 * MINUTE },
  { name: "content-publish", lockName: "job:content-publish", schedule: { kind: "interval", everyMs: MINUTE }, timeoutMs: 5 * MINUTE },
  { name: "newsletter-weekly-digest", lockName: "job:newsletter-weekly-digest", schedule: { kind: "interval", everyMs: HOUR }, timeoutMs: 30 * MINUTE },
  { name: "rate-limit-cleanup", lockName: "job:rate-limit-cleanup", schedule: { kind: "interval", everyMs: HOUR }, timeoutMs: 5 * MINUTE },
];

/** The IST calendar date (YYYY-MM-DD) that contains the instant. */
export function istDayKey(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MINUTES * MINUTE).toISOString().slice(0, 10);
}

/** The UTC instant at which an IST calendar day's wall-clock time occurs. */
export function istInstant(dayKey: string, hour: number, minute: number): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour, minute) - IST_OFFSET_MINUTES * MINUTE);
}

function previousDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * True when the job should run now. `lastRunAt` is the last SUCCESSFUL run (undefined if never).
 *
 * - interval: due when `everyMs` has passed since the last run, or it has never run.
 * - daily-ist: each IST day has one due instant. The most recent one at or before `now` is the target.
 *   The job is due while the last successful run is before that instant, so a worker that was down
 *   at 00:30 IST catches up on its next tick.
 */
export function isDue(job: JobDefinition, lastRunAt: Date | undefined, now: Date): boolean {
  const schedule = job.schedule;
  if (schedule.kind === "interval") {
    return lastRunAt === undefined || now.getTime() - lastRunAt.getTime() >= schedule.everyMs;
  }
  const today = istDayKey(now);
  const todayTarget = istInstant(today, schedule.hour, schedule.minute);
  const latestDue = now.getTime() >= todayTarget.getTime()
    ? todayTarget
    : istInstant(previousDayKey(today), schedule.hour, schedule.minute);
  return lastRunAt === undefined || lastRunAt.getTime() < latestDue.getTime();
}
