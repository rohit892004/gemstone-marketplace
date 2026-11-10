import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Demo photos live in prisma/demo-photos (Pixabay, demo only; see prisma/demo-photos/README.md). The demo seeds
 * read them from here, run them through the media pipeline and store the results. Originals are never served.
 */
export const DEMO_PHOTO_DIR = path.join(process.cwd(), "prisma", "demo-photos");

const PHOTO_NAME = /^[a-z]+(-[a-z]+)*-\d{2}\.(jpg|png)$/;

/** File names for one photo set, e.g. listDemoPhotos("ruby") gives ["ruby-01.jpg", ...]. Sorted. */
export async function listDemoPhotos(prefix: string): Promise<string[]> {
  const names = (await readdir(DEMO_PHOTO_DIR))
    .filter((name) => PHOTO_NAME.test(name) && name.startsWith(`${prefix}-`))
    .sort();
  if (names.length === 0) throw new Error(`No demo photos found for "${prefix}" in ${DEMO_PHOTO_DIR}`);
  return names;
}

/** Reads one demo photo by file name. Rejects anything that is not a plain photo file name. */
export async function readDemoPhoto(name: string): Promise<Buffer> {
  if (!PHOTO_NAME.test(name)) throw new Error(`Invalid demo photo name: ${name}`);
  return readFile(path.join(DEMO_PHOTO_DIR, name));
}
