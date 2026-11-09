import { getEnv } from "./env";

/** Absolute URL for links in emails. `path` must start with "/". */
export function appUrl(path: string): string {
  if (!path.startsWith("/")) throw new Error("appUrl path must start with '/'");
  return new URL(path, getEnv().APP_URL).toString();
}
