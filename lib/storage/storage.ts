import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "@/lib/config/env";
import { createS3StorageFromEnv } from "@/lib/storage/s3-storage";

/**
 * Private object storage. Keys are opaque relative paths like "sellers/abc/doc-1.pdf".
 * Nothing stored here is publicly reachable. Serve files only through
 * authorised route handlers.
 */
export interface StorageProvider {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/** Allowed key shape: lowercase segments, a file extension. Blocks "..", absolute paths and backslashes. */
const KEY_PATTERN = /^[a-z0-9_-]+(\/[a-z0-9_-]+)*\.[a-z0-9]{2,5}$/;

export function assertValidStorageKey(key: string): void {
  if (!KEY_PATTERN.test(key) || key.includes("..")) {
    throw new Error(`Invalid storage key: ${key}`);
  }
}

export class LocalDiskStorageProvider implements StorageProvider {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    assertValidStorageKey(key);
    const full = path.resolve(this.root, key);
    const rootResolved = path.resolve(this.root) + path.sep;
    if (!full.startsWith(rootResolved)) throw new Error("Storage path escapes root");
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data, { flag: "wx" }); // never overwrite an existing object
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

let override: StorageProvider | undefined;
let instance: StorageProvider | undefined;

/** Tests only. */
export function setStorageProviderForTests(provider: StorageProvider | undefined): void {
  override = provider;
}

/** Chooses the provider from STORAGE_PROVIDER: "local" (default) or "s3". Refuses s3 without bucket and keys. */
export function getStorageProvider(): StorageProvider {
  if (override) return override;
  if (!instance) {
    const env = getEnv();
    instance =
      env.STORAGE_PROVIDER === "s3"
        ? createS3StorageFromEnv(env)
        : new LocalDiskStorageProvider(path.resolve(env.STORAGE_DIR));
  }
  return instance;
}
