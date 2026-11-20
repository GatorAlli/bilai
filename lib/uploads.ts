// Relative import: also loaded by vitest and the tsx scripts.
import { MAX_IMAGES } from "./cat-limits";

// Listing photos live in Cloudflare R2 (lib/cloudflareR2.ts) under
// "cats/<publicId>-<n>.webp", n = 1..MAX_IMAGES, and browsers load them from
// the bucket's public domain (R2_PUBLIC_URL).
const CAT_PHOTO_KEY = new RegExp(`^cats/[a-z0-9]{8}-[1-${MAX_IMAGES}]\\.webp$`);

export function catPhotoKey(publicId: string, n: number) {
  return `cats/${publicId}-${n}.webp`;
}

export function isCatPhotoKey(key: string) {
  return CAT_PHOTO_KEY.test(key);
}

// Public URL of a photo on the bucket's public domain.
export function catPhotoUrl(key: string) {
  const base = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");
  if (!base) throw new Error("R2_PUBLIC_URL is not set");
  return `${base}/${key}`;
}

export function isWebp(buf: Buffer) {
  return (
    buf.length > 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  );
}
