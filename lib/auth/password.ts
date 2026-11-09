import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// scrypt parameters (OWASP-recommended minimum range). Encoded into each hash so they can be raised later.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LEN = 64;
// scrypt needs 128*N*r bytes (32 MB here); Node's default cap is 32 MB, so raise it.
const MAXMEM = 128 * N * R * 2;

/** Returns "scrypt$N$r$p$saltBase64$hashBase64". */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * A valid hash of a random value. Used to spend the same CPU time when a login
 * email does not exist, so response timing does not reveal account existence.
 */
let dummyHashPromise: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(randomBytes(24).toString("hex"));
  return dummyHashPromise;
}
