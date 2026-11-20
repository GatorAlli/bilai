import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// Cloudflare R2 through its S3-compatible API. Server code only (it holds the
// secret key); no "server-only" import so the tsx scripts can use it too.
export const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
  // Only send/verify checksums when an operation requires one; Cloudflare
  // recommends this for aws-sdk-js-v3 >= 3.729 against R2.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET!;

// Keys are never reused (each listing has its own public id and photos can't
// be edited), so browsers and Cloudflare's CDN may keep them for a year.
const PHOTO_CACHE_CONTROL = "public, max-age=31536000, immutable";

export async function putCatPhoto(key: string, body: Buffer) {
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: "image/webp",
      CacheControl: PHOTO_CACHE_CONTROL,
    }),
  );
}

// Best-effort: a leftover object only wastes storage, so this logs instead of
// throwing and never undoes the database change that made it unreachable.
export async function deleteCatPhotos(keys: string[]) {
  if (keys.length === 0) return;
  try {
    // DeleteObjects takes at most 1000 keys per request.
    for (let i = 0; i < keys.length; i += 1000) {
      const { Errors } = await s3.send(
        new DeleteObjectsCommand({
          Bucket: R2_BUCKET,
          Delete: {
            Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })),
            Quiet: true,
          },
        }),
      );
      if (Errors?.length) {
        console.error("Couldn't remove some listing photos from R2", Errors);
      }
    }
  } catch (error) {
    console.error("Couldn't remove listing photos from R2", error);
  }
}
