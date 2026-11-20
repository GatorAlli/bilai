// Shared between the client form and the server actions.
export const HEIF_IMAGE_TYPES = [
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
  ".heic",
  ".heif",
  ".heics",
  ".heifs",
] as const;
export const ACCEPTED_IMAGE_TYPES: readonly string[] = [
  "image/jpeg",
  ".jpg",
  ".jpeg",
  "image/png",
  ".png",
  "image/gif",
  ".gif",
  "image/webp",
  ".webp",
  "image/avif",
  ".avif",
  "image/bmp",
  ".bmp",
  ...HEIF_IMAGE_TYPES,
] as const;
export const MAX_IMAGES = 5;

// What the user may pick (phone photos are big); we shrink them afterwards.
export const MAX_INPUT_SIZE_MB = 25;
export const MAX_INPUT_SIZE_BYTES = MAX_INPUT_SIZE_MB * 1024 * 1024;

// What we store: always WebP, long edge <= 1600px, <= 1 MB.
export const MAX_DIMENSION = 1600;
export const TARGET_SIZE_BYTES = 1 * 1024 * 1024;
// Server accepts a little slack over the target.
export const MAX_STORED_SIZE_BYTES = Math.round(1.25 * 1024 * 1024);

export const CAT_STATUSES = ["available", "pending", "adopted"] as const;
export const YES_NO_UNKNOWN = ["yes", "no", "unknown"] as const;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_TEMPERAMENT_LENGTH = 200;
export const MAX_REHOMING_REASON_LENGTH = 500;
export const CONTACT_METHODS = ["whatsapp", "call"] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];
