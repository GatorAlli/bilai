import "dotenv/config";
import { randomBytes } from "node:crypto";
import { deleteCatPhotos, putCatPhoto } from "../lib/cloudflareR2";

// End-to-end check of the R2 setup, run with `npm run r2:check`:
// upload through the S3 API -> read back from R2_PUBLIC_URL (what browsers
// use) -> delete. Exits non-zero with the reason if any step fails.

// A valid 1x1 WebP.
const PIXEL = Buffer.from(
  "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=",
  "base64",
);

function fail(message: string): never {
  throw new Error(message);
}

async function main() {
  for (const name of [
    "CLOUDFLARE_R2_ENDPOINT",
    "CLOUDFLARE_R2_ACCESS_KEY",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_R2_BUCKET",
    "R2_PUBLIC_URL",
  ]) {
    if (!process.env[name]) fail(`${name} is not set`);
  }
  const base = process.env.R2_PUBLIC_URL!.replace(/\/+$/, "");
  const key = `cats/_check-${randomBytes(6).toString("hex")}.webp`;
  const url = `${base}/${key}`;

  console.log(`1/3 upload ${key}`);
  await putCatPhoto(key, PIXEL);

  try {
    console.log(`2/3 fetch ${url}`);
    const res = await fetch(url, { cache: "no-store" });
    if (res.status !== 200) {
      fail(
        `public URL returned ${res.status}. Is public access (custom domain or r2.dev URL) enabled, and does R2_PUBLIC_URL point at it?`,
      );
    }
    const type = res.headers.get("content-type");
    if (type !== "image/webp") fail(`content-type was ${type}`);
    const cacheControl = res.headers.get("cache-control") ?? "";
    if (!cacheControl.includes("immutable")) {
      fail(`cache-control was "${cacheControl}"`);
    }
    const body = Buffer.from(await res.arrayBuffer());
    if (!body.equals(PIXEL)) fail("downloaded bytes don't match the upload");
  } finally {
    console.log("3/3 delete");
    await deleteCatPhotos([key]);
  }

  // A cached copy may linger on the CDN briefly; retry before complaining.
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${url}?gone=${attempt}`, { cache: "no-store" });
    if (res.status === 404) {
      console.log("R2 OK: upload, public read and delete all work.");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  fail("object is still publicly reachable after delete");
}

main().catch((error) => {
  console.error(`R2 check failed: ${error.message ?? error}`);
  process.exit(1);
});
