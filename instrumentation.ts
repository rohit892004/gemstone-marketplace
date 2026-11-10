/**
 * Runs once when the Node server starts. Validates the environment so a misconfigured production
 * deployment fails at startup with a clear message listing every problem, not on the first request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { parseStartupEnv } = await import("@/lib/config/env");
  parseStartupEnv(process.env);
}
