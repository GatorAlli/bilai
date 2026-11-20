-- Every photo now lives in R2 (moved by the one-off photos:migrate script), and
-- photo URLs are built from the key, so the base64 bytes and stored URL go.
ALTER TABLE "cat_images" DROP COLUMN IF EXISTS "data";
--> statement-breakpoint
ALTER TABLE "cat_images" DROP COLUMN IF EXISTS "url";
