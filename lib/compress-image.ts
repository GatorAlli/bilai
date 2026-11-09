import { MAX_DIMENSION, TARGET_SIZE_BYTES } from "@/lib/cat-limits";

const QUALITIES = [0.82, 0.72, 0.62, 0.5, 0.4];

/** Resizes to MAX_DIMENSION and re-encodes as WebP under TARGET_SIZE_BYTES. */
export async function compressImage(file: File): Promise<File> {
  // "from-image" applies the photo's rotation before EXIF is stripped.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });

  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of QUALITIES) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (!blob) throw new Error(`${file.name}: couldn't compress the image.`);
    // Browsers that can't encode WebP silently return PNG instead.
    if (blob.type !== "image/webp") {
      throw new Error("Your browser can't convert images to WebP.");
    }
    if (blob.size <= TARGET_SIZE_BYTES) {
      const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
      return new File([blob], name, { type: "image/webp" });
    }
  }
  throw new Error(`${file.name}: too detailed to compress under 1 MB.`);
}
