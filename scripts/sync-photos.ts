import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_ROOT, isWebp } from "../lib/uploads";

// Run on any checkout with old local uploads to recover them into shared storage.
// Also export shared photos into uploads/ so they can be committed to GitHub.
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const photos = await sql`SELECT id, key, data FROM cat_images`;
  let imported = 0;
  let exported = 0;
  let missing = 0;
  for (const photo of photos) {
    const file = path.resolve(UPLOAD_ROOT, photo.key);
    if (
      !file.startsWith(path.resolve(UPLOAD_ROOT) + path.sep) ||
      !file.endsWith(".webp")
    ) {
      throw new Error("Invalid stored photo path");
    }
    if (photo.data) {
      const data = Buffer.from(photo.data, "base64");
      if (!isWebp(data)) throw new Error("Invalid shared WebP photo");
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, data);
      exported++;
    } else {
      let data: Buffer;
      try {
        data = await readFile(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        missing++;
        continue;
      }
      if (!isWebp(data)) throw new Error("Invalid local WebP photo");
      await sql`UPDATE cat_images SET data = ${data.toString("base64")} WHERE id = ${photo.id} AND data IS NULL`;
      imported++;
    }
  }
  console.log({ imported, exported, missing });
  if (missing) {
    console.warn(
      "Some photos are missing here. Run photos:sync on the computer that uploaded them.",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
