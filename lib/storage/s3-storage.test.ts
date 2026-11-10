import { describe, expect, it } from "vitest";
import { S3StorageProvider, type S3SendClient } from "./s3-storage";

class FakeS3 implements S3SendClient {
  readonly commands: { name: string; input: Record<string, unknown> }[] = [];
  objects = new Map<string, Buffer>();

  async send(command: unknown): Promise<unknown> {
    const c = command as { constructor: { name: string }; input: Record<string, unknown> };
    const name = c.constructor.name;
    this.commands.push({ name, input: c.input });
    const key = String(c.input.Key);
    if (name === "PutObjectCommand") {
      this.objects.set(key, c.input.Body as Buffer);
      return {};
    }
    if (name === "GetObjectCommand") {
      const data = this.objects.get(key);
      if (!data) throw new Error("NoSuchKey");
      return { Body: { transformToByteArray: async () => new Uint8Array(data) } };
    }
    if (name === "DeleteObjectCommand") {
      this.objects.delete(key);
      return {};
    }
    throw new Error(`unexpected command ${name}`);
  }
}

describe("S3StorageProvider", () => {
  it("puts, gets and deletes through the bucket and key", async () => {
    const fake = new FakeS3();
    const storage = new S3StorageProvider({ bucket: "gs-private", client: fake });
    await storage.put("sellers/abc/doc-1.pdf", Buffer.from("hello"));
    expect((await storage.get("sellers/abc/doc-1.pdf")).toString()).toBe("hello");
    await storage.delete("sellers/abc/doc-1.pdf");
    expect(fake.objects.size).toBe(0);
    expect(fake.commands.every((c) => c.input.Bucket === "gs-private")).toBe(true);
  });

  it("never sets an ACL, so objects stay private", async () => {
    const fake = new FakeS3();
    await new S3StorageProvider({ bucket: "b", client: fake }).put("a/b.txt", Buffer.from("x"));
    expect(fake.commands[0].input).not.toHaveProperty("ACL");
  });

  it("refuses to overwrite an existing key (conditional put)", async () => {
    const fake = new FakeS3();
    await new S3StorageProvider({ bucket: "b", client: fake }).put("a/b.txt", Buffer.from("x"));
    expect(fake.commands[0].input.IfNoneMatch).toBe("*");
  });

  it("rejects invalid keys before any request is sent", async () => {
    const fake = new FakeS3();
    const storage = new S3StorageProvider({ bucket: "b", client: fake });
    await expect(storage.put("../etc/passwd.txt", Buffer.from("x"))).rejects.toThrow(/Invalid storage key/);
    await expect(storage.get("/abs/file.pdf")).rejects.toThrow(/Invalid storage key/);
    await expect(storage.delete("a\b.pdf")).rejects.toThrow(/Invalid storage key/);
    expect(fake.commands).toHaveLength(0);
  });
});
