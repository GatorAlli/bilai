import { readFile } from "node:fs/promises";
import path from "node:path";

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
    const data = await readFile(file);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
