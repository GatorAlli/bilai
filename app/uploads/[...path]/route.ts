import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { catImages, cats } from "@/db/schema";
import { isLiveListing } from "@/lib/listing-expiry";
import { UPLOAD_ROOT } from "@/lib/uploads";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;

  const root = path.resolve(UPLOAD_ROOT);
  const file = path.resolve(root, ...segments);

  // Block ../ tricks: the resolved path must stay inside uploads/.
  if (!file.startsWith(root + path.sep) || !file.endsWith(".webp")) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const key = segments.join("/");
    const [photo] = await db
      .select({ data: catImages.data })
      .from(catImages)
      .innerJoin(cats, eq(catImages.catId, cats.id))
      .where(and(eq(catImages.key, key), isLiveListing))
      .limit(1);
    // Only serve images belonging to a current, unexpired listing.
    if (!photo) return new Response("Not found", { status: 404 });
    const data = photo.data
      ? Buffer.from(photo.data, "base64")
      : await readFile(file);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        // Listings expire after a week, so browsers needn't keep photos longer.
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response("Not found", { status: 404 });
    }
    console.error("Could not load listing photo", error);
    return new Response("Photo temporarily unavailable", { status: 503 });
  }
}
