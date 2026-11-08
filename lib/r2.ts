import "server-only";
import { S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2 is S3-compatible; only the endpoint and region differ.
export const r2 = new S3Client({
  region: "auto",
  // Newer SDK versions add a CRC32 checksum to presigned URLs, which browsers
  // can't satisfy and R2 rejects. Only compute checksums when required.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME!;

/** Public base URL of the bucket (r2.dev URL or custom domain), no trailing slash. */
export const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? "").replace(
  /\/$/,
  "",
);
