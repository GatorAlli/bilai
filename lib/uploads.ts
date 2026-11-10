import { unlink } from "node:fs/promises";
import path from "node:path";

// Legacy local uploads and GitHub photo exports. New uploads live in PostgreSQL.
export const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

export function isWebp(buf: Buffer) {
  return (
    buf.length > 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  );
}

// Best-effort removal of local copies of deleted photos.
export async function removeLocalPhotos(keys: string[]) {
  const root = path.resolve(UPLOAD_ROOT);
  await Promise.all(
    keys.map(async (key) => {
      const file = path.resolve(root, key);
      // Only files inside uploads/; never directories or other paths.
      if (!file.startsWith(root + path.sep) || !file.endsWith(".webp")) return;
      try {
        await unlink(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          console.error("Couldn't remove local listing photo", error);
        }
      }
    }),
  );
}
