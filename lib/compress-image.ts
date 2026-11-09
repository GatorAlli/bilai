import { MAX_DIMENSION, TARGET_SIZE_BYTES } from "@/lib/cat-limits";

/** Thrown with a message that is safe to show to the user. */
export class ImageUploadError extends Error {}

/**
 * Picks the first-pass WebP quality from how far over the target the original
 * file is. Small files keep more detail; huge ones start lower so the first
 * pass usually lands under the limit on its own.
 */
function firstPassQuality(fileSize: number) {
  const ratio = fileSize / TARGET_SIZE_BYTES;
  if (ratio <= 2) return 0.82;
  if (ratio <= 5) return 0.72;
  if (ratio <= 10) return 0.62;
  return 0.52;
}

function encodeWebp(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable.");
  ctx.drawImage(source, 0, 0, width, height);
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
}

/**
 * Resizes to MAX_DIMENSION and re-encodes as WebP under TARGET_SIZE_BYTES,
 * in at most two encodes. Errors thrown are ImageUploadError with a plain
 * message; the technical cause goes to the console.
 */

export async function compressImage(file: File): Promise<File> {
  let bitmap: ImageBitmap | undefined;
  try {
    // "from-image" applies the photo's rotation before EXIF is stripped.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    let width = Math.round(bitmap.width * scale);
    let height = Math.round(bitmap.height * scale);
    const quality = firstPassQuality(file.size);

    let blob = await encodeWebp(bitmap, width, height, quality);
    if (!blob) throw new Error("canvas.toBlob returned null.");
    // Browsers that can't encode WebP silently return PNG instead.
    if (blob.type !== "image/webp") {
      throw new Error(`Browser can't encode WebP (got ${blob.type}).`);
    }

    if (blob.size > TARGET_SIZE_BYTES) {
      // Second (last) pass: file size scales roughly with pixel count, so
      // shrink the area by the overshoot, with 10% headroom.
      const shrink = Math.sqrt((TARGET_SIZE_BYTES * 0.9) / blob.size);
      width = Math.max(1, Math.round(width * shrink));
      height = Math.max(1, Math.round(height * shrink));
      blob = await encodeWebp(bitmap, width, height, quality);
      if (!blob) throw new Error("canvas.toBlob returned null.");
    }

    if (blob.size > TARGET_SIZE_BYTES) {
      console.error(
        `${file.name}: still ${blob.size} bytes after two passes (target ${TARGET_SIZE_BYTES}).`,
      );
      throw new ImageUploadError(
        `${file.name}: this photo is too large. Please try a different one.`,
      );
    }

    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch (err) {
    if (err instanceof ImageUploadError) throw err;
    console.error(`Compressing ${file.name} failed:`, err);
    throw new ImageUploadError(`${file.name}: upload failed.`);
  } finally {
    bitmap?.close();
  }
}
