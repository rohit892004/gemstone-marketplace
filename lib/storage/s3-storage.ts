import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { assertValidStorageKey, type StorageProvider } from "@/lib/storage/storage";

/** The part of the S3 client this provider uses. Tests pass a fake that records commands. */
export interface S3SendClient {
  send(command: unknown): Promise<unknown>;
}

export interface S3StorageOptions {
  bucket: string;
  client: S3SendClient;
}

/**
 * S3-compatible private storage (AWS S3, Cloudflare R2, DigitalOcean Spaces).
 *
 * Objects are written WITHOUT an ACL and the bucket must keep public access blocked, so nothing is
 * reachable by URL. Files leave only through authorised route handlers, as with the local provider.
 * `IfNoneMatch: "*"` makes a put fail when the key already exists, matching the local "wx" flag.
 * (Conditional writes are supported by AWS S3 and R2; verify on Spaces before relying on it.)
 */
export class S3StorageProvider implements StorageProvider {
  private readonly bucket: string;
  private readonly client: S3SendClient;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.client = options.client;
  }

  async put(key: string, data: Buffer): Promise<void> {
    assertValidStorageKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentLength: data.length,
        IfNoneMatch: "*",
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    assertValidStorageKey(key);
    const response = (await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))) as {
      Body?: { transformToByteArray(): Promise<Uint8Array> };
    };
    if (!response.Body) throw new Error("Storage object has no body");
    return Buffer.from(await response.Body.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    assertValidStorageKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

/** Builds the real S3 client from validated env values. Throws if bucket or keys are missing. */
export function createS3StorageFromEnv(env: {
  S3_BUCKET?: string;
  S3_REGION?: string;
  S3_ENDPOINT?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_FORCE_PATH_STYLE: "true" | "false";
}): S3StorageProvider {
  if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error("STORAGE_PROVIDER=s3 needs S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
  }
  const client = new S3Client({
    // R2 uses "auto"; AWS needs a real region. Default to us-east-1 when no custom endpoint is set.
    region: env.S3_REGION ?? (env.S3_ENDPOINT ? "auto" : "us-east-1"),
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
  return new S3StorageProvider({ bucket: env.S3_BUCKET, client });
}
